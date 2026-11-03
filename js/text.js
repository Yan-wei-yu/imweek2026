// 學生輸入的文字：整理空白、檢查長度、文字雲分組。畫面上一律用 textContent 顯示，不會被當成 HTML

const OUTER_PUNCTUATION = /^[\p{P}\s]+|[\p{P}\s]+$/gu;

/** 字數用看得到的字來算：emoji、中文都算一個 */
export const charCount = (text) => Array.from(text).length;

/** 去掉頭尾空白，換行和連續空白縮成一個空格；不是字串就當成空字串 */
export function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** 送出前的檢查：空的回傳 "empty"，超過 max 個字回傳 "long"，沒問題回傳 null */
export function textProblem(text, max) {
  if (text.length === 0) return "empty";
  return charCount(text) > max ? "long" : null;
}

/** 文字雲上顯示的樣子：去掉頭尾的標點 */
export const displayWord = (value) => cleanText(value).replace(OUTER_PUNCTUATION, "");

/** 文字雲分組用：全形半形統一、英文不分大小寫（統一後可能多出半形標點，再去一次） */
export const wordKey = (value) => displayWord(value).normalize("NFKC").toLowerCase().replace(OUTER_PUNCTUATION, "");
