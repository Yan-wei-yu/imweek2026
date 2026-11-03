// 互動頁的設定。Firebase 專案建好之後，把主控台「專案設定 → 一般 → 你的應用程式」裡的
// firebaseConfig 整段貼到 FIREBASE_CONFIG。這些值本來就會公開在網頁裡，不是密碼；
// 誰能讀寫什麼由 firestore.rules 決定。還沒貼（null）的時候，頁面會用示範模式。
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyC_EIyO-yGDxFX3tNWkYeOzg1hyu2FPklo",
  authDomain: "nfu-ppt.firebaseapp.com",
  projectId: "nfu-ppt",
  storageBucket: "nfu-ppt.firebasestorage.app",
  messagingSenderId: "64099855213",
  appId: "1:64099855213:web:90911bc69860f2062a0864",
});

// 講座當天用第一個；彩排在網址後面加 ?s=rehearsal，資料跟正式場分開。要跟 firestore.rules 一致
export const SESSIONS = Object.freeze(["imweek2026", "rehearsal"]);

// 每人能送幾則、每則幾個字。則數要跟 firestore.rules 一致（規則裡的 _[0-2] 就是最多 3 則）
export const LIMITS = Object.freeze({
  words: 3,
  wordLength: 12,
  comments: 3,
  commentLength: 150,
  questions: 3,
  questionLength: 150,
});

/** 這次用哪一場的資料：網址上的 ?s=…，不在名單上就用正式場 */
export function currentSession(search = globalThis.location?.search ?? "") {
  const wanted = new URLSearchParams(search).get("s");
  return SESSIONS.includes(wanted) ? wanted : SESSIONS[0];
}
