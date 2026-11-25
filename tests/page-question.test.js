import { test } from "node:test";
import assert from "node:assert/strict";
import { askTarget, askedOrder, pageLabel, pageQuestionFields, shownPage } from "../js/page-question.js";

const DECKS = {
  s1: { title: "第一節　職涯與成長", count: 40 },
  s2: { title: "第二節　在 LuxCreo 怎麼做開發", count: 0 },
};
const page = (deck, n) => ({ deck, page: n });

test("shownPage：跟著講者時是講者正在播的頁", () => {
  assert.deepEqual(shownPage({ deck: "s1", index: 12 }, null), page("s1", 12));
});

test("shownPage：往回翻時是自己翻到的頁", () => {
  assert.deepEqual(shownPage({ deck: "s1", index: 12 }, 8), page("s1", 8));
});

test("shownPage：還沒開始放投影片回傳 null", () => {
  assert.equal(shownPage(null, null), null);
});

test("askTarget：輸入框收起來時跟著畫面上的頁", () => {
  assert.deepEqual(askTarget(page("s1", 8), page("s1", 9), { open: false, byStudent: false }), page("s1", 9));
});

test("askTarget：輸入框打開後，講者換頁不會改掉要問的頁", () => {
  assert.deepEqual(askTarget(page("s1", 8), page("s1", 9), { open: true, byStudent: false }), page("s1", 8));
  assert.deepEqual(askTarget(page("s1", 40), page("s2", 1), { open: true, byStudent: false }), page("s1", 40));
});

test("askTarget：輸入框打開後，學生自己翻頁就改成翻到的頁", () => {
  assert.deepEqual(askTarget(page("s1", 8), page("s1", 6), { open: true, byStudent: true }), page("s1", 6));
});

test("askTarget：講者停止放映時，打開的輸入框還是問原本那一頁", () => {
  assert.deepEqual(askTarget(page("s1", 8), null, { open: true, byStudent: false }), page("s1", 8));
});

test("pageLabel：標成「第一節 第 12 頁」", () => {
  assert.equal(pageLabel(DECKS, page("s1", 12)), "第一節 第 12 頁");
  assert.equal(pageLabel(DECKS, page("s2", 5)), "第二節 第 5 頁");
});

test("pageLabel：在 Q&A 那一頁問的（沒有頁數）回傳空字串", () => {
  assert.equal(pageLabel(DECKS, { text: "想問…" }), "");
  assert.equal(pageLabel(DECKS, null), "");
  assert.equal(pageLabel(DECKS, { deck: "s1", page: "12" }), "");
});

test("pageLabel：不認得的簡報代號直接顯示代號", () => {
  assert.equal(pageLabel(DECKS, page("s9", 3)), "s9 第 3 頁");
});

test("pageQuestionFields：寫進資料庫的欄位", () => {
  assert.deepEqual(pageQuestionFields("u1", "這頁的流程怎麼來的？", page("s1", 12)), {
    uid: "u1", text: "這頁的流程怎麼來的？", hidden: false, answered: false, deck: "s1", page: 12,
  });
});

test("askedOrder：還沒回答的在前，同一組新的在前；不改動傳進來的陣列", () => {
  const questions = [
    { id: "a", at: 1, answered: false },
    { id: "b", at: 3, answered: true },
    { id: "c", at: 2, answered: false },
    { id: "d", at: 4, answered: false },
  ];
  const before = questions.map((q) => q.id);
  assert.deepEqual(askedOrder(questions).map((q) => q.id), ["d", "c", "a", "b"]);
  assert.deepEqual(questions.map((q) => q.id), before);
});
