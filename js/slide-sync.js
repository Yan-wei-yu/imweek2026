// 「跟著看簡報」的規則：PowerPoint 播到哪一頁 → 學生手機該顯示什麼。都是純函式，方便測試

/** PowerPoint 正在播的檔名 → 互動頁的簡報代號（s1／s2／s3）；不認得的回傳 null */
export function deckOf(fileName, decks) {
  const found = Object.entries(decks).find(([, deck]) => deck.file === fileName);
  return found ? found[0] : null;
}

/**
 * 同步小程式回報的狀態 → 要寫進場次的 { activity, slide }。
 * 第三節的互動題那幾頁切成對應的題目，其他頁都是「投影片」；沒在放映、不認得的簡報回傳 null（維持原狀）
 */
export function sessionFor(state, decks, activities) {
  if (!state?.running || !Number.isInteger(state.index) || state.index < 1) return null;
  const deck = deckOf(state.file, decks);
  if (!deck) return null;
  return { activity: activities[deck]?.[state.index] ?? "slides", slide: { deck, index: state.index } };
}

/** 題目和頁數都一樣（一樣就不用再寫一次資料庫） */
export function sameSession(a, b) {
  return Boolean(a && b)
    && a.activity === b.activity
    && a.slide?.deck === b.slide?.deck
    && a.slide?.index === b.slide?.index;
}

/** 某一頁投影片的圖片網址；不公開的簡報（count 是 0）或超出範圍回傳 null */
export function slideImage(decks, deck, index) {
  const info = decks[deck];
  if (!info || !Number.isInteger(index) || index < 1 || index > info.count) return null;
  return `slides/${deck}/${String(index).padStart(2, "0")}.webp`;
}
