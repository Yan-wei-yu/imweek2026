import { test } from "node:test";
import assert from "node:assert/strict";
import { countPoll, newestFirst, pollShares, pollSummary, rankQuestions, wordFrequencies } from "../js/tally.js";

test("countPoll 算每個選項幾票，範圍外或型別不對的不算", () => {
  const responses = [{ choice: 0 }, { choice: 2 }, { choice: 2 }, { choice: 9 }, { choice: "1" }, {}];
  assert.deepEqual(countPoll(responses, 5), { counts: [1, 0, 2, 0, 0], total: 3 });
});

test("countPoll 沒人投票時每個選項都是 0", () => {
  assert.deepEqual(countPoll([], 3), { counts: [0, 0, 0], total: 0 });
});

test("pollSummary 讀講者頁寫的統計，總數用各選項重新加總", () => {
  const doc = { counts: [3, 0, 1, 0, 0], total: 99, at: 1, id: "poll" };
  assert.deepEqual(pollSummary(doc, 5), { counts: [3, 0, 1, 0, 0], total: 4 });
});

test("pollSummary 還沒有統計、或格式不對時回傳 null", () => {
  assert.equal(pollSummary(null, 5), null);
  assert.equal(pollSummary({}, 5), null);
  assert.equal(pollSummary({ counts: [1, 2, 3] }, 5), null);
  assert.equal(pollSummary({ counts: [1, -1, 0, 0, 0] }, 5), null);
  assert.equal(pollSummary({ counts: [1, 0.5, 0, 0, 0] }, 5), null);
  assert.equal(pollSummary({ counts: ["1", 0, 0, 0, 0] }, 5), null);
});

test("pollShares 每個選項佔幾 %；沒人投票時都是 0", () => {
  assert.deepEqual(pollShares({ counts: [1, 2, 0], total: 3 }), [33, 67, 0]);
  assert.deepEqual(pollShares({ counts: [0, 0, 0], total: 0 }), [0, 0, 0]);
});

test("wordFrequencies 合併同一個詞的不同寫法，顯示最多人用的寫法", () => {
  const words = ["AI", "ai", "ＡＩ", "AI！", "好用", "好用", "方便"].map((text) => ({ text }));
  assert.deepEqual(wordFrequencies(words), [["AI", 4], ["好用", 2], ["方便", 1]]);
});

test("wordFrequencies 次數一樣時照第一次出現的順序", () => {
  const words = ["方便", "好用", "快"].map((text) => ({ text }));
  assert.deepEqual(wordFrequencies(words), [["方便", 1], ["好用", 1], ["快", 1]]);
});

test("wordFrequencies 略過空白、只有標點和沒有文字的回答", () => {
  assert.deepEqual(wordFrequencies([{ text: "  " }, { text: "！！" }, { text: undefined }, {}]), []);
});

test("rankQuestions 還沒回答的在前、讚多的在前、同票的先問先排", () => {
  const questions = [
    { id: "a", at: 1, answered: false },
    { id: "b", at: 2, answered: false },
    { id: "c", at: 3, answered: true },
    { id: "d", at: 4, answered: false },
  ];
  const votes = ["b", "b", "c", "c", "c", "d", "a"].map((qid) => ({ qid }));
  const ranked = rankQuestions(questions, votes);
  assert.deepEqual(ranked.map((q) => [q.id, q.votes]), [["b", 2], ["a", 1], ["d", 1], ["c", 3]]);
});

test("rankQuestions 不改動傳進來的陣列和物件", () => {
  const questions = [{ id: "a", at: 2, answered: false }, { id: "b", at: 1, answered: false }];
  const before = structuredClone(questions);
  rankQuestions(questions, [{ qid: "b" }]);
  assert.deepEqual(questions, before);
});

test("newestFirst 新的排前面，不改動原本的陣列", () => {
  const items = [{ id: "a", at: 1 }, { id: "b", at: 3 }, { id: "c", at: 2 }];
  assert.deepEqual(newestFirst(items).map((item) => item.id), ["b", "c", "a"]);
  assert.deepEqual(items.map((item) => item.id), ["a", "b", "c"]);
});
