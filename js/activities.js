// 講者切換的順序：大廳 → 投影片（跟著看簡報）→ 投票 → 文字雲 → 討論 01～03 → Q&A → 結束。ID 要跟 firestore.rules 一致
import { DISCUSSIONS } from "./questions.js";

export const ACTIVITIES = Object.freeze([
  { id: "lobby", label: "大廳" },
  { id: "slides", label: "投影片" },
  { id: "poll", label: "投票" },
  { id: "cloud", label: "文字雲" },
  ...DISCUSSIONS.map(({ id, title }) => ({ id, label: title })),
  { id: "qa", label: "Q&A" },
  { id: "end", label: "結束" },
]);
