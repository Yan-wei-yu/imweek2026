// 這個檔案是產生出來的，不要直接改：在 im-week-2026 執行 npm run live:slides

export const DECKS = Object.freeze({
  "s1": {
    "title": "第一節　職涯與成長",
    "file": "第一節_職涯與成長.pptx",
    "count": 22
  },
  "s2": {
    "title": "第二節　在 LuxCreo 怎麼做開發",
    "file": "第二節_在LuxCreo怎麼做開發.pptx",
    "count": 0
  },
  "s3": {
    "title": "第三節　一起討論",
    "file": "第三節_一起討論.pptx",
    "count": 14
  }
});

// 第三節播到這幾頁時，學生手機自動切成作答畫面
export const SLIDE_ACTIVITIES = Object.freeze({
  "s3": {
    "3": "poll",
    "4": "cloud",
    "6": "d1",
    "7": "d2",
    "8": "d3",
    "13": "qa"
  }
});
