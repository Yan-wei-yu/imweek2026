// 資料存取的入口：有 Firebase 設定就連 Firestore，還沒設定就用示範模式（store-demo.js）
import { FIREBASE_CONFIG } from "./config.js";

/**
 * 兩種模式提供一樣的方法；路徑都是 Firestore 的格式（例如 sessions/imweek2026/poll）
 * @typedef {object} Store
 * @property {"firebase" | "demo"} mode
 * @property {() => ({ uid: string, isAnonymous: boolean, email: string | null } | null)} user
 * @property {() => Promise<{ uid: string, isAnonymous: boolean, email: string | null }>} signIn 學生是匿名登入；講者是 Google 登入
 * @property {() => Promise<void>} signOut
 * @property {(path: string, onData: (doc: object | null) => void, onError?: (err: Error) => void) => () => void} watchDoc
 * @property {(path: string, filters: [string, unknown][], onData: (docs: object[]) => void, onError?: (err: Error) => void) => () => void} watchQuery 只支援「欄位等於某值」的條件
 * @property {(path: string) => Promise<object | null>} getDoc
 * @property {(path: string, filters: [string, unknown][]) => Promise<object[]>} getQuery
 * @property {(path: string, data: object) => Promise<void>} set 欄位值放 NOW 會換成伺服器時間
 * @property {(path: string, data: object) => Promise<void>} update
 * @property {(path: string) => Promise<void>} remove
 */

/**
 * @param {"audience" | "host"} role 學生頁只需要匿名登入；講者頁要能用 Google 登入
 * @returns {Promise<Store>}
 */
export async function createStore(role) {
  if (FIREBASE_CONFIG) {
    const { createFirebaseStore } = await import("./store-firebase.js");
    return createFirebaseStore(FIREBASE_CONFIG, role);
  }
  const { createDemoStore } = await import("./store-demo.js");
  return createDemoStore(role);
}
