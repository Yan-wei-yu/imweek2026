// 這個檔案是產生出來的，不要直接改：題目改第三節的 content.js，再到 im-week-2026 執行 npm run live:sync

export const EVENT = Object.freeze({
  "name": "2026 資管週",
  "section": "第三節　一起討論",
  "title": "AI 這麼強，還需要我們嗎？",
  "titleLines": [
    "AI 這麼強，",
    "還需要我們嗎？"
  ]
});

export const POLL = Object.freeze({
  "label": "線上投票 · 單選",
  "question": "你最常用 AI 做什麼？",
  "options": [
    {
      "name": "寫程式",
      "desc": "debug、產生程式碼"
    },
    {
      "name": "寫報告、作業",
      "desc": "整理重點、潤稿"
    },
    {
      "name": "查資料、學新東西",
      "desc": "問問題、找解釋"
    },
    {
      "name": "翻譯、整理文字",
      "desc": "英文文件、會議紀錄"
    },
    {
      "name": "幾乎不用",
      "desc": "還在觀望"
    }
  ]
});

export const CLOUD = Object.freeze({
  "label": "線上作答 · 文字雲",
  "prompt": "用一個詞，形容你對 AI 的感覺"
});

export const DISCUSSIONS = Object.freeze([
  {
    "id": "d1",
    "title": "討論 01",
    "question": "哪些工作會被 AI 取代？哪些不會？"
  },
  {
    "id": "d2",
    "title": "討論 02",
    "question": "資管系學的東西，哪些在 AI 時代更重要？"
  },
  {
    "id": "d3",
    "title": "討論 03",
    "question": "如果你是主管，會怎麼讓 AI 和人一起工作？"
  }
]);

export const QA = Object.freeze({
  "title": "Q&A",
  "prompt": "有什麼想問的？"
});
