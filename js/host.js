// 講者投影頁：切換題目、即時看結果。正式模式要用 Google 登入，而且帳號要寫在 firestore.rules 裡
import { createStore } from "./store.js";
import { NOW, paths } from "./store-common.js";
import { SESSIONS, currentSession } from "./config.js";
import { ACTIVITIES } from "./activities.js";
import { createViews } from "./host-views.js";
import { drawQr } from "./qr.js";
import { h } from "./dom.js";

const sid = currentSession();
const P = paths(sid);
// 學生頁跟講者頁放在同一個資料夾；彩排場的網址要帶上 ?s=
const audienceUrl = new URL(sid === SESSIONS[0] ? "./" : `./?s=${sid}`, location.href).href;
const shortUrl = audienceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
const FLASH_MS = 6000;
// 大廳和結束頁本身就有 QR code 或不需要，其他題目在角落放一個小的給晚到的同學
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

let store = null;
let views = null;
let activity = null;
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

function go(id) {
  if (!id || id === activity) return;
  show(id);
  store.set(P.session, { activity: id, at: NOW }).catch((err) => {
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

function start() {
  document.getElementById("demo").hidden = store.mode !== "demo";
  document.getElementById("session").textContent = sid === SESSIONS[0] ? "" : `彩排場（${sid}）`;
  views = createViews({ store, P, stage, audienceUrl, shortUrl, report });
  tabs.replaceChildren(...ACTIVITIES.map((item, i) => h("button", {
    class: "tab", type: "button", "data-id": item.id, title: `${item.label}（按 ${i + 1}）`, onclick: () => go(item.id),
  }, item.label)));
  drawQr(document.getElementById("corner-qr"), audienceUrl, { size: 260 });
  document.getElementById("corner-url").textContent = shortUrl;
  document.getElementById("qr-toggle").addEventListener("click", toggleCorner);
  document.addEventListener("keydown", onKey);
  store.watchDoc(P.session, (session) => show(session?.activity ?? "lobby"), (err) => {
    flash("連線中斷，請重新整理");
    report(err);
  });
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
