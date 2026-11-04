// 學生手機頁：講者切到哪一題，這裡就顯示哪一題；不用登入，全程匿名
import { createStore } from "./store.js";
import { NOW, nextSlot, paths } from "./store-common.js";
import { LIMITS, currentSession } from "./config.js";
import { CLOUD, DISCUSSIONS, EVENT, POLL, QA } from "./questions.js";
import { charCount, cleanText, textProblem } from "./text.js";
import { newestFirst } from "./tally.js";
import { renderSlides } from "./slides-view.js";
import { h } from "./dom.js";

const P = paths(currentSession());
const LETTERS = "ABCDEFGHIJ";
// 同一個 Wi-Fi 一下子很多人登入時，Firebase 可能暫時擋一下：等 2～8 秒再試，最多 6 次
const RETRY_CODES = new Set(["auth/too-many-requests", "auth/quota-exceeded", "auth/network-request-failed"]);
const SIGN_IN_TRIES = 6;
// 送出超過 8 秒還沒回應，多半是網路慢，先讓學生知道還在送
const SLOW_MS = 8000;
const view = document.getElementById("view");
const statusEl = document.getElementById("status");
// 還沒送出的字：講者換題再換回來時還在
const drafts = new Map();

let store = null;
let me = null;
let current = null;
let cleanup = () => {};
let accountWarning = "";
let lastSession = null;
const sessionListeners = new Set();

/** 講者換頁時通知（跟著看簡報用）：先回一次目前的狀態；回傳取消函式 */
function onSession(listener) {
  sessionListeners.add(listener);
  listener(lastSession);
  return () => sessionListeners.delete(listener);
}

const mount = (...children) => view.replaceChildren(...children);
const heading = (kicker, title) => [h("p", { class: "kicker" }, kicker), h("h1", {}, title)];
const limitReached = () => Object.assign(new Error("已經送滿了"), { code: "limit" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function report(err) {
  console.error(err);
}

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", warn);
}

function watchFailed(err) {
  setStatus("連線中斷，請重新整理", true);
  report(err);
}

/** 送出失敗時給學生看的說明；被規則擋下來時，再確認一次是不是講者已經換題 */
async function explain(err) {
  if (err?.code === "limit") return "已經送滿了，謝謝！";
  if (err?.code === "permission-denied") {
    const session = await store.getDoc(P.session).catch(() => null);
    if (session && session.activity !== current) return "這一題已經結束了";
  }
  return "沒送出去，請再試一次";
}

/** 輸入框加送出按鈕；key 用來保留還沒送出的字，onSubmit 出錯時保留輸入、顯示說明 */
function textForm({ key, label, placeholder, max, multiline = false, onSubmit }) {
  const id = `field-${key}`;
  const field = h(multiline ? "textarea" : "input", {
    id, class: "field", placeholder, maxlength: max, autocomplete: "off",
    rows: multiline ? 3 : null, enterkeyhint: multiline ? null : "send",
  });
  field.value = drafts.get(key) ?? "";
  const counter = h("span", { class: "counter" });
  const hint = h("p", { class: "hint", role: "status" });
  const button = h("button", { class: "btn", type: "submit" }, "送出");
  let locked = false;
  const count = () => {
    counter.textContent = `${charCount(cleanText(field.value))}／${max}`;
  };
  field.addEventListener("input", () => {
    drafts.set(key, field.value);
    count();
  });
  count();

  async function submit(event) {
    event.preventDefault();
    const text = cleanText(field.value);
    const problem = textProblem(text, max);
    if (problem) {
      hint.textContent = problem === "empty" ? "先寫點什麼再送出" : `最多 ${max} 個字`;
      return;
    }
    button.disabled = true;
    hint.textContent = "送出中…";
    const slow = setTimeout(() => {
      hint.textContent = "網路比較慢，還在送…";
    }, SLOW_MS);
    try {
      await onSubmit(text);
      field.value = "";
      drafts.delete(key);
      count();
      hint.textContent = "已送出";
    } catch (err) {
      // 送滿了是預期中的情況，畫面上已經說明，不用記成錯誤
      if (err?.code !== "limit") report(err);
      hint.textContent = await explain(err);
    } finally {
      clearTimeout(slow);
      button.disabled = locked;
    }
  }

  const el = h("form", { class: "compose", onsubmit: submit }, [
    h("label", { class: "sr-only", for: id }, label),
    field,
    h("div", { class: "compose-row" }, [counter, button]),
    hint,
  ]);
  return {
    el,
    lock(isLocked) {
      locked = isLocked;
      field.disabled = isLocked;
      button.disabled = isLocked;
    },
  };
}

/**
 * 自己送過的東西（文字雲、討論、Q&A 共用）：一直跟資料庫同步，送滿 max 則就鎖住輸入框。
 * 第一次讀回來之前先鎖住，免得選到已經用過的編號
 */
function submissions({ path, filters, prefix, max, form, render }) {
  let mine = [];
  let ready = false;
  const refresh = () => {
    render(mine);
    form.lock(!ready || mine.length >= max);
  };
  refresh();
  const stop = store.watchQuery(path, filters, (docs) => {
    mine = docs;
    ready = true;
    refresh();
  }, watchFailed);
  return {
    async add(fields) {
      const k = nextSlot(mine.map((item) => item.id), prefix, max);
      if (k === null) throw limitReached();
      await store.set(`${path}/${prefix}${k}`, { ...fields, at: NOW });
    },
    stop,
  };
}

function renderLobby() {
  mount(
    ...heading(EVENT.section, EVENT.title),
    h("p", { class: "lead" }, "等講者開始，題目出現時這一頁會自動切換"),
    h("p", { class: "note" }, "全程匿名：講者只看得到大家寫了什麼，看不到是誰寫的"),
  );
}

function renderEnd() {
  mount(...heading(EVENT.name, "謝謝參與！"), h("p", { class: "lead" }, "這一頁可以關掉了"));
}

function renderPoll() {
  const note = h("p", { class: "hint", role: "status" }, "選一個，送出後還可以改");
  const buttons = POLL.options.map((option, i) => h("button", {
    class: "option", type: "button", "aria-pressed": "false", onclick: () => choose(i),
  }, [
    h("span", { class: "letter" }, LETTERS[i]),
    h("span", { class: "name" }, option.name),
    h("span", { class: "desc" }, option.desc),
  ]));
  mount(...heading(POLL.label, POLL.question), h("div", { class: "options" }, buttons), note);

  let alive = true;
  let chosen = null;
  const mark = (choice) => buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === choice)));
  store.getDoc(`${P.poll}/${me}`).then((mine) => {
    if (!alive || !mine) return;
    chosen = mine.choice;
    mark(chosen);
  }).catch(report);

  async function choose(i) {
    mark(i);
    note.textContent = "送出中…";
    const slow = setTimeout(() => {
      if (alive) note.textContent = "網路比較慢，還在送…";
    }, SLOW_MS);
    try {
      await store.set(`${P.poll}/${me}`, { choice: i, at: NOW });
      chosen = i;
      if (alive) note.textContent = `已送出：${LETTERS[i]} ${POLL.options[i].name}（想改可以再點別的）`;
    } catch (err) {
      report(err);
      const message = await explain(err);
      if (alive) {
        mark(chosen);
        note.textContent = message;
      }
    } finally {
      clearTimeout(slow);
    }
  }
  return () => {
    alive = false;
  };
}

function renderCloud() {
  const max = LIMITS.words;
  const chips = h("ul", { class: "chips", "aria-label": "你送出的詞" });
  const left = h("p", { class: "note" });
  const form = textForm({
    key: "cloud", label: "一個詞", placeholder: "例如：方便", max: LIMITS.wordLength,
    onSubmit: (text) => subs.add({ uid: me, text, hidden: false }),
  });
  mount(...heading(CLOUD.label, CLOUD.prompt), form.el, left, chips);
  const subs = submissions({
    path: P.cloud, filters: [["uid", me]], prefix: `${me}_`, max, form,
    render(mine) {
      chips.replaceChildren(...mine.map((word) => h("li", {}, word.text)));
      left.textContent = mine.length < max ? `每人最多 ${max} 個詞，還可以送 ${max - mine.length} 個` : `已經送了 ${max} 個詞，謝謝！`;
    },
  });
  return subs.stop;
}

function renderDiscussion({ id, title, question }) {
  const max = LIMITS.comments;
  const list = h("ul", { class: "mine", "aria-label": "你送出的想法" });
  const left = h("p", { class: "note" });
  const form = textForm({
    key: id, label: "你的想法", placeholder: "寫下你的想法…", max: LIMITS.commentLength, multiline: true,
    onSubmit: (text) => subs.add({ uid: me, topic: id, text, hidden: false }),
  });
  mount(...heading(title, question), form.el, left, list);
  const subs = submissions({
    path: P.comments, filters: [["uid", me], ["topic", id]], prefix: `${id}_${me}_`, max, form,
    render(mine) {
      list.replaceChildren(...newestFirst(mine).map((comment) => h("li", {}, comment.text)));
      left.textContent = mine.length < max ? `匿名送出，每題最多 ${max} 則` : `這一題已經送了 ${max} 則，謝謝！`;
    },
  });
  return subs.stop;
}

function renderQA() {
  const max = LIMITS.questions;
  const list = h("ol", { class: "questions" });
  const left = h("p", { class: "note" });
  const form = textForm({
    key: "qa", label: "你的問題", placeholder: "想問講者什麼？", max: LIMITS.questionLength, multiline: true,
    onSubmit: (text) => subs.add({ uid: me, text, hidden: false, answered: false }),
  });
  mount(
    ...heading(QA.title, QA.prompt), form.el, left,
    h("h2", {}, "大家的問題"), h("p", { class: "note" }, "幫想聽的問題按讚，讚多的講者先回答"), list,
  );
  const subs = submissions({
    path: P.questions, filters: [["uid", me]], prefix: `${me}_`, max, form,
    render(mine) {
      left.textContent = mine.length < max ? `匿名提問，每人最多 ${max} 題` : `已經問了 ${max} 題，謝謝！`;
    },
  });

  let questions = [];
  let voted = new Set();
  // 自己按過哪些讚讀回來之前，先不讓按，免得重複按到已經按過的
  let votesReady = false;
  // 每題的畫面元素留著重複使用：清單一直在更新時，按到一半的按鈕不會被換掉
  const items = new Map();

  async function vote(qid) {
    const path = `${P.votes}/${qid}__${me}`;
    try {
      await (voted.has(qid) ? store.remove(path) : store.set(path, { uid: me, qid, at: NOW }));
    } catch (err) {
      report(err);
      left.textContent = await explain(err);
    }
  }

  function itemFor(question) {
    if (!items.has(question.id)) {
      const text = h("p", {});
      const tags = h("span", { class: "tags" });
      const button = h("button", { class: "vote", type: "button", onclick: () => vote(question.id) });
      const el = h("li", { class: "question" }, [text, h("div", { class: "question-meta" }, [tags, button])]);
      items.set(question.id, { el, text, tags, button });
    }
    const { el, text, tags, button } = items.get(question.id);
    const on = voted.has(question.id);
    text.textContent = question.text;
    tags.replaceChildren(...[
      question.uid === me ? h("span", { class: "tag" }, "你問的") : null,
      question.answered ? h("span", { class: "tag done" }, "已回答") : null,
    ].filter(Boolean));
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "已按讚" : "按讚";
    button.disabled = !votesReady;
    return el;
  }

  function draw() {
    const els = questions.map(itemFor);
    const unchanged = els.length === list.children.length && els.every((el, i) => list.children[i] === el);
    if (!unchanged) list.replaceChildren(...els);
    const visible = new Set(questions.map((question) => question.id));
    for (const id of items.keys()) {
      if (!visible.has(id)) items.delete(id);
    }
  }

  const stops = [
    store.watchQuery(P.questions, [["hidden", false]], (docs) => {
      questions = newestFirst(docs);
      draw();
    }, watchFailed),
    store.watchQuery(P.votes, [["uid", me]], (docs) => {
      voted = new Set(docs.map((v) => v.qid));
      votesReady = true;
      draw();
    }, watchFailed),
  ];
  return () => {
    subs.stop();
    stops.forEach((stop) => stop());
  };
}

const RENDERERS = new Map([
  ["lobby", renderLobby],
  ["slides", () => renderSlides(mount, onSession)],
  ["poll", renderPoll],
  ["cloud", renderCloud],
  ...DISCUSSIONS.map((discussion) => [discussion.id, () => renderDiscussion(discussion)]),
  ["qa", renderQA],
  ["end", renderEnd],
]);

/** 換到講者目前的題目；不認得的當成大廳 */
function show(activity) {
  const next = RENDERERS.has(activity) ? activity : "lobby";
  if (next === current) return;
  current = next;
  cleanup();
  cleanup = RENDERERS.get(next)() ?? (() => {});
  window.scrollTo(0, 0);
}

/** 匿名登入；被「同一個網路太多人」暫時擋住時，等一下再試 */
async function signInWithRetry() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await store.signIn();
    } catch (err) {
      if (!RETRY_CODES.has(err?.code) || attempt >= SIGN_IN_TRIES) throw err;
      setStatus("人很多，重試中…", true);
      await sleep(2000 + Math.random() * 6000);
    }
  }
}

async function main() {
  let user;
  try {
    store = await createStore("audience");
    user = await signInWithRetry();
  } catch (err) {
    setStatus("連不上", true);
    mount(
      h("p", { class: "lead" }, "連不上互動頁，等一下再試"),
      h("button", { class: "btn", type: "button", onclick: () => location.reload() }, "再試一次"),
    );
    report(err);
    return;
  }
  me = user.uid;
  document.getElementById("demo").hidden = store.mode !== "demo";
  // 講者頁和學生頁在同一個瀏覽器會共用登入：用講者帳號作答，會算在講者身上
  accountWarning = user.isAnonymous ? "" : "目前是講者帳號，請用無痕視窗試學生頁";
  setStatus(accountWarning || (navigator.onLine ? "" : "目前沒有網路"), Boolean(accountWarning) || !navigator.onLine);
  store.watchDoc(P.session, (session) => {
    lastSession = session;
    show(session?.activity);
    sessionListeners.forEach((listener) => listener(session));
  }, watchFailed);
}

window.addEventListener("offline", () => setStatus("目前沒有網路", true));
window.addEventListener("online", () => setStatus(accountWarning, Boolean(accountWarning)));
main();
