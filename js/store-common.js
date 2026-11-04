// 兩種資料來源（Firebase、示範模式）共用的東西：資料路徑、伺服器時間的記號、每人幾則的編號

/** 寫入時換成伺服器時間（Firebase）或這台電腦的時間（示範模式） */
export const NOW = Object.freeze({ serverTime: true });

/** 一場活動底下的資料路徑；sid 是場次（正式場或彩排） */
export function paths(sid) {
  const root = `sessions/${sid}`;
  return Object.freeze({
    session: root,
    poll: `${root}/poll`,
    // 投票統計：講者頁寫，學生手機投完票後讀這一份就好
    pollResults: `${root}/results/poll`,
    cloud: `${root}/cloud`,
    comments: `${root}/comments`,
    questions: `${root}/questions`,
    votes: `${root}/votes`,
  });
}

/**
 * 每人最多 max 則，文件 ID 是 prefix 加上 0～max-1；回傳還沒用過的最小編號，用完了回傳 null。
 * firestore.rules 用同樣的 ID 規則擋住第 max+1 則
 */
export function nextSlot(usedIds, prefix, max) {
  for (let k = 0; k < max; k += 1) {
    if (!usedIds.includes(`${prefix}${k}`)) return k;
  }
  return null;
}
