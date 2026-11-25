// 匿名問這一頁：學生在「跟著看簡報」時對某一頁提問，記下第幾節第幾頁（講者頁、Q&A 都標出來）。都是純函式

/**
 * 學生畫面上的那一頁：往回翻時是自己翻到的頁，不然是講者正在播的頁
 * @param {{ deck: string, index: number } | null} live 講者正在播的頁
 * @param {number | null} viewing 自己往回翻時在看的頁數；null 是跟著講者
 * @returns {{ deck: string, page: number } | null} 還沒開始放投影片時是 null
 */
export function shownPage(live, viewing) {
  if (!live) return null;
  return { deck: live.deck, page: viewing ?? live.index };
}

/**
 * 要問的是哪一頁：輸入框收起來時跟著畫面上的頁；打開之後只有學生自己翻頁才改，講者換頁不改
 * （不然寫到一半講者換頁，問題就標到下一頁去了）
 * @param {{ deck: string, page: number } | null} target 目前要問的頁
 * @param {{ deck: string, page: number } | null} shown 畫面上的頁
 * @param {{ open: boolean, byStudent: boolean }} how 輸入框有沒有打開、這次換頁是不是學生自己翻的
 * @returns {{ deck: string, page: number } | null}
 */
export function askTarget(target, shown, { open, byStudent }) {
  if (!open || !target) return shown;
  return byStudent && shown ? shown : target;
}

/**
 * 問題上標的頁數，例如「第一節 第 12 頁」；在 Q&A 那一頁問的（沒有頁數）回傳空字串
 * @param {Record<string, { title: string }>} decks slides.js 的 DECKS
 * @param {{ deck?: unknown, page?: unknown } | null} question
 * @returns {string}
 */
export function pageLabel(decks, question) {
  const { deck, page } = question ?? {};
  if (typeof deck !== "string" || !Number.isInteger(page)) return "";
  const title = decks[deck]?.title ?? deck;
  return `${title.split("　")[0]} 第 ${page} 頁`;
}

/**
 * 寫進資料庫的欄位（時間 at 另外加）；欄位要跟 firestore.rules 的 questions 一致（npm test 會檢查）
 * @param {string} uid
 * @param {string} text
 * @param {{ deck: string, page: number }} target
 */
export function pageQuestionFields(uid, text, target) {
  return { uid, text, hidden: false, answered: false, deck: target.deck, page: target.page };
}

/**
 * 講者頁「學生提問」的順序：還沒回答的在前，同一組新的在前；回傳新陣列
 * @template {{ at: number, answered?: boolean }} T
 * @param {T[]} questions
 * @returns {T[]}
 */
export function askedOrder(questions) {
  return [...questions].sort((a, b) => Number(Boolean(a.answered)) - Number(Boolean(b.answered)) || b.at - a.at);
}
