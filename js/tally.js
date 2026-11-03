// 講者頁的統計：投票、文字雲字頻、Q&A 排序。都是純函式，不改動傳進來的資料
import { displayWord, wordKey } from "./text.js";

/** 每個選項幾票；範圍外或型別不對的選項不算 */
export function countPoll(responses, optionCount) {
  const counts = Array.from({ length: optionCount }, (_, i) => responses.filter(({ choice }) => choice === i).length);
  return { counts, total: counts.reduce((sum, n) => sum + n, 0) };
}

/** 出現最多次的寫法；一樣多就取先出現的 */
function mostCommon(forms) {
  let best = null;
  for (const [form, n] of forms) {
    if (best === null || n > best[1]) best = [form, n];
  }
  return best[0];
}

/**
 * 文字雲的字頻：同一個詞的不同寫法（全半形、大小寫、頭尾標點）合併計數，顯示最多人用的寫法
 * @param {{ text?: string }[]} entries
 * @returns {[string, number][]} 次數多的在前；次數一樣照第一次出現的順序
 */
export function wordFrequencies(entries) {
  const groups = new Map();
  for (const { text } of entries) {
    const key = wordKey(text);
    if (key) {
      const shown = displayWord(text);
      const group = groups.get(key) ?? { count: 0, forms: new Map() };
      group.count += 1;
      group.forms.set(shown, (group.forms.get(shown) ?? 0) + 1);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map(({ count, forms }) => [mostCommon(forms), count])
    .sort((a, b) => b[1] - a[1]);
}

/** Q&A 排序：還沒回答的在前，讚多的在前，同票的先問先排；回傳新陣列，每題多一個 votes */
export function rankQuestions(questions, votes) {
  const tally = new Map();
  for (const { qid } of votes) tally.set(qid, (tally.get(qid) ?? 0) + 1);
  return questions
    .map((question) => ({ ...question, votes: tally.get(question.id) ?? 0 }))
    .sort((a, b) => Number(Boolean(a.answered)) - Number(Boolean(b.answered)) || b.votes - a.votes || a.at - b.at);
}

/** 新的排前面；回傳新陣列 */
export const newestFirst = (items) => [...items].sort((a, b) => b.at - a.at);
