// 正式模式：資料存在 Firebase 的 Firestore，手機和講者頁即時同步
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc as fetchDoc,
  getDocs as fetchDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { NOW } from "./store-common.js";

/** NOW 換成伺服器時間 */
const forWrite = (data) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value === NOW ? serverTimestamp() : value]),
);

/** Firestore 的文件轉成一般物件；時間換成毫秒，剛寫入、還沒回到伺服器的先用估計值 */
function fromSnapshot(snap) {
  const data = snap.data({ serverTimestamps: "estimate" });
  return { ...data, id: snap.id, at: data.at?.toMillis?.() ?? 0 };
}

export async function createFirebaseStore(config, role) {
  const app = initializeApp(config);
  // 學生頁只用匿名登入，不需要彈出視窗登入的設定；講者頁要用 Google 彈出視窗登入
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    ...(role === "host" ? { popupRedirectResolver: browserPopupRedirectResolver } : {}),
  });
  const db = getFirestore(app);
  await auth.authStateReady();

  const filtered = (path, filters) => query(
    collection(db, path),
    ...filters.map(([field, value]) => where(field, "==", value)),
  );

  return {
    mode: "firebase",
    user: () => auth.currentUser,
    async signIn() {
      if (role !== "host") return auth.currentUser ?? (await signInAnonymously(auth)).user;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return (await signInWithPopup(auth, provider)).user;
    },
    signOut: () => signOut(auth),
    watchDoc: (path, onData, onError) => onSnapshot(
      doc(db, path),
      (snap) => onData(snap.exists() ? fromSnapshot(snap) : null),
      onError,
    ),
    watchQuery: (path, filters, onData, onError) => onSnapshot(
      filtered(path, filters),
      (snap) => onData(snap.docs.map(fromSnapshot)),
      onError,
    ),
    async getDoc(path) {
      const snap = await fetchDoc(doc(db, path));
      return snap.exists() ? fromSnapshot(snap) : null;
    },
    getQuery: async (path, filters) => (await fetchDocs(filtered(path, filters))).docs.map(fromSnapshot),
    set: (path, data) => setDoc(doc(db, path), forWrite(data)),
    update: (path, data) => updateDoc(doc(db, path), forWrite(data)),
    remove: (path) => deleteDoc(doc(db, path)),
  };
}
