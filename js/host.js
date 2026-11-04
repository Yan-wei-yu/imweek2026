// 講者投影頁：切換題目、即時看結果。正式模式要用 Google 登入，而且帳號要寫在 firestore.rules 裡。
// 從同步小程式（npm run live:bridge）打開時，會跟著 PowerPoint 自動換頁、切題
import { createStore } from "./store.js";
import { NOW, paths } from "./store-common.js";
import { PUBLIC_URL, SESSIONS, currentSession } from "./config.js";
import { ACTIVITIES } from "./activities.js";
import { DECKS, SLIDE_ACTIVITIES } from "./slides.js";
import { sameSession, sessionFor } from "./slide-sync.js";
import { createViews } from "./host-views.js";
import { drawQr } from "./qr.js";
import { h } from "./dom.js";

const sid = currentSession();
const P = paths(sid);
const FLASH_MS = 6000;
// 同步小程式回報 PowerPoint 狀態的網址；從 GitHub Pages 打開時沒有這個，就手動切題
const BRIDGE = "bridge/state";
const BRIDGE_MS = 700;
const BRIDGE_TIMEOUT_MS = 2000;
// 同一份文件每秒最多寫一次（Firestore 的上限）；快速連續換頁時，等一下再寫停下來的那一頁
const MIN_WRITE_GAP_MS = 1000;
// 大廳和結束頁本身就有 QR code 或不需要，其他畫面在角落放一個小的給晚到的同學
const NO_CORNER = new Set(["lobby", "end"]);
// 第一次設定最常遇到的登入問題，直接說要去哪裡改
const SIGN_IN_ERRORS = {
  "auth/unauthorized-domain": "這個網址還沒加進 Firebase：Authentication → 設定 → 授權網域",
  "auth/popup-blocked": "瀏覽器擋住了登入視窗：允許這個網站彈出視窗，再按一次",
  "auth/operation-not-allowed": "Firebase 還沒開啟 Google 登入：Authentication → 登入方式",
  "auth/network-request-failed": "網路連不上，檢查一下再試",
  "auth/web-storage-unsupported": "這個視窗不能保存登入狀態，換一般視窗（不要用無痕）再試",
};
// 自己關掉登入視窗、或連按兩次取消了前一個視窗：不算錯誤，按鈕恢復就好
const SIGN_IN_CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

const stage = document.getElementById("stage");
const tabs = document.getElementById("tabs");
const flashEl = document.getElementById("flash");
const corner = document.getElementById("corner");
const bridgeEl = document.getElementById("bridge");
const sessionListeners = new Set();

let store = null;
let views = null;
let activity = null;
let lastSession = null;
let synced = null; // 已經寫進資料庫的 { activity, slide }
let lastWriteAt = 0;
let writing = false;
let bridgeStopped = false;
let cleanup = () => {};
let cornerWanted = true;
let flashTimer = null;

function report(err) {
  console.error(err);
}

function flash(text) {
  flashEl.textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashEl.textContent = "";
  }, FLASH_MS);
}

/** 學生頁的網址：正式模式一律用公開網址，示範模式用這台電腦上的學生頁；彩排場帶上 ?s= */
function audienceLink(mode) {
  const url = mode === "demo" ? new URL("./", location.href) : new URL(PUBLIC_URL);
  const params = new URLSearchParams();
  if (sid !== SESSIONS[0]) params.set("s", sid);
  if (mode === "demo") params.set("demo", "1");
  url.search = params.toString();
  return url.href;
}

/** 場次狀態改變時通知（投影片畫面用）：先回一次目前的狀態；回傳取消函式 */
function onSession(listener) {
  sessionListeners.add(listener);
  listener(lastSession);
  return () => sessionListeners.delete(listener);
}

/** 讀一份只有講者讀得到的文件：被規則擋下來就不是講者（Firestore 不准用 __開頭結尾__ 的 ID） */
async function isHost() {
  try {
    await store.getDoc(`${P.poll}/host-check`);
    return true;
  } catch (err) {
    if (err?.code === "permission-denied") return false;
    throw err;
  }
}

function gate(children) {
  stage.replaceChildren(h("section", { class: "gate" }, children));
}

function showSignIn(message = "") {
  gate([
    h("h1", {}, "講者登入"),
    h("p", { class: "lead" }, "用 Google 帳號登入後，才能切換題目、看結果"),
    message ? h("p", { class: "warn-text" }, message) : null,
    h("button", { class: "btn", type: "button", onclick: signIn }, "用 Google 登入"),
  ]);
}

function showNotHost(user) {
  gate([
    h("h1", {}, "這個帳號還不是講者"),
    h("p", { class: "lead" }, `${user.email ?? "這個帳號"} 登入成功了，但 firestore.rules 裡還沒有它`),
    h("p", {}, "把下面這串 UID 貼進 firestore.rules 的 HOST_UID，再到 Firebase 主控台發布規則，然後重新整理這一頁："),
    h("code", { class: "uid" }, user.uid),
    h("button", {
      class: "btn ghost", type: "button",
      onclick: () => store.signOut().then(() => showSignIn()).catch(report),
    }, "換一個帳號"),
  ]);
}

async function signIn(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const user = await store.signIn();
    if (await isHost()) start();
    else showNotHost(user);
  } catch (err) {
    if (SIGN_IN_CANCELLED.has(err?.code)) {
      button.disabled = false;
      return;
    }
    showSignIn(SIGN_IN_ERRORS[err?.code] ?? "登入沒有成功，再試一次");
    report(err);
  }
}

function markTab() {
  for (const tab of tabs.children) tab.setAttribute("aria-current", String(tab.dataset.id === activity));
}

function updateCorner() {
  corner.hidden = !cornerWanted || NO_CORNER.has(activity);
}

/** 畫出某一題；學生那邊跟著講者頁寫進資料庫的題目走 */
function show(id) {
  if (id === activity) return;
  activity = id;
  cleanup();
  cleanup = views.render(id);
  markTab();
  updateCorner();
}

/** 手動切題；目前播到哪一頁投影片照樣留著 */
function go(id) {
  if (!id || id === activity) return;
  show(id);
  const slide = lastSession?.slide;
  store.set(P.session, { activity: id, ...(slide ? { slide } : {}), at: NOW }).catch((err) => {
    flash(err?.code === "permission-denied" ? "切換失敗：這個帳號沒有講者權限" : "切換失敗，檢查一下網路");
    report(err);
  });
}

function onKey(event) {
  if (event.target.closest?.("input, textarea") || event.altKey || event.ctrlKey || event.metaKey) return;
  const index = ACTIVITIES.findIndex((item) => item.id === activity);
  if (event.key === "ArrowRight" || event.key === "PageDown") go(ACTIVITIES[Math.min(index + 1, ACTIVITIES.length - 1)].id);
  else if (event.key === "ArrowLeft" || event.key === "PageUp") go(ACTIVITIES[Math.max(index - 1, 0)].id);
  else if (/^[1-9]$/.test(event.key)) go(ACTIVITIES[Number(event.key) - 1]?.id);
  else if (event.key === "q" || event.key === "Q") toggleCorner();
}

function toggleCorner() {
  cornerWanted = !cornerWanted;
  updateCorner();
}

/** 同步小程式在不在：從 GitHub Pages 打開時沒有，就手動切題 */
async function bridgeAvailable() {
  try {
    const response = await fetch(BRIDGE, { cache: "no-store", signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

/** 上方的同步狀態：讓講者一眼看出手機有沒有在跟 */
function bridgeLabel(state, next) {
  if (bridgeStopped) return "同步停止：Firebase 規則還沒發布，或這個帳號不是講者";
  if (!state) return "同步程式沒有回應";
  if (!state.running) return "PowerPoint 沒有在放映";
  if (!next) return `不認得的簡報檔：${state.file ?? ""}`;
  return `同步中：第 ${state.index} 頁`;
}

/**
 * Worker 每 0.7 秒回報一次 PowerPoint 的狀態（null 是同步小程式沒回應）。換頁了就寫進場次：
 * 第三節的互動題那幾頁切成作答畫面，其他頁是「投影片」。講者頁自己的畫面跟著資料庫走，寫入被擋就不會換
 */
async function onBridgeState(state) {
  const next = state ? sessionFor(state, DECKS, SLIDE_ACTIVITIES) : null;
  bridgeEl.textContent = bridgeLabel(state, next);
  if (bridgeStopped || !next || sameSession(next, synced) || writing) return;
  if (Date.now() - lastWriteAt < MIN_WRITE_GAP_MS) return; // 下一次回報再寫
  writing = true;
  lastWriteAt = Date.now();
  try {
    await store.set(P.session, { ...next, at: NOW });
    synced = next;
  } catch (err) {
    report(err);
    // 被規則擋下來不會自己好，停止同步、不要每 0.7 秒重送；網路問題下一次回報會再試
    if (err?.code === "permission-denied") bridgeStopped = true;
    else flash("同步失敗，檢查一下網路");
    bridgeEl.textContent = bridgeLabel(state, next);
  } finally {
    writing = false;
  }
}

async function startBridge() {
  if (!(await bridgeAvailable())) return;
  bridgeEl.hidden = false;
  const worker = new Worker(new URL("./bridge-worker.js", import.meta.url));
  worker.addEventListener("message", ({ data }) => {
    onBridgeState(data).catch(report);
  });
  worker.addEventListener("error", (event) => {
    bridgeEl.textContent = "同步程式停了，請重新整理";
    report(event);
  });
  worker.postMessage({ url: new URL(BRIDGE, location.href).href, interval: BRIDGE_MS, timeout: BRIDGE_TIMEOUT_MS });
}

function start() {
  const link = audienceLink(store.mode);
  const shortUrl = link.replace(/^https?:\/\//, "").replace(/\/$/, "");
  document.getElementById("demo").hidden = store.mode !== "demo";
  document.getElementById("session").textContent = sid === SESSIONS[0] ? "" : `彩排場（${sid}）`;
  views = createViews({ store, P, stage, audienceUrl: link, shortUrl, report, onSession });
  tabs.replaceChildren(...ACTIVITIES.map((item, i) => h("button", {
    class: "tab", type: "button", "data-id": item.id, title: `${item.label}（按 ${i + 1}）`, onclick: () => go(item.id),
  }, item.label)));
  drawQr(document.getElementById("corner-qr"), link, { size: 260 });
  document.getElementById("corner-url").textContent = shortUrl;
  document.getElementById("qr-toggle").addEventListener("click", toggleCorner);
  document.addEventListener("keydown", onKey);
  store.watchDoc(P.session, (session) => {
    lastSession = session;
    show(session?.activity ?? "lobby");
    sessionListeners.forEach((listener) => listener(session));
  }, (err) => {
    flash("連線中斷，請重新整理");
    report(err);
  });
  startBridge();
}

async function main() {
  try {
    store = await createStore("host");
    if (store.mode === "demo") {
      await store.signIn();
      start();
      return;
    }
    const user = store.user();
    if (user && !user.isAnonymous && (await isHost())) start();
    else showSignIn();
  } catch (err) {
    gate([h("h1", {}, "載入失敗"), h("p", { class: "lead" }, "檢查一下網路，再重新整理這一頁")]);
    report(err);
  }
}

main();
