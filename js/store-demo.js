// 示範模式：還沒設定 Firebase 時用。資料存在這台電腦的瀏覽器（localStorage），同一個瀏覽器的分頁會互相同步：
// 一個分頁開講者頁（host.html），再開幾個分頁當學生（index.html），就能把整個流程走一遍
import { NOW } from "./store-common.js";

const KEY = "imweek-live-demo";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** 每個分頁當成不同的學生：代號存在這個分頁的 sessionStorage，重新整理也不變 */
function tabUid() {
  const saved = sessionStorage.getItem(`${KEY}-uid`);
  if (saved) return saved;
  const uid = `demo${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  sessionStorage.setItem(`${KEY}-uid`, uid);
  return uid;
}

const resolve = (data) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value === NOW ? Date.now() : value]),
);
const lastPart = (path) => path.slice(path.lastIndexOf("/") + 1);

/** path 底下直接的文件（不含更深一層的） */
const childrenOf = (db, path) => Object.entries(db)
  .filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/"));

export async function createDemoStore(role) {
  const watchers = new Set();
  let db = load();
  let user = null;

  const notify = () => watchers.forEach((watcher) => watcher());
  // 別的分頁改了資料：storage 事件一定在資料寫好之後才觸發（自己這個分頁不會收到，改完直接 notify）
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    db = load();
    notify();
  });

  function commit(next) {
    db = next;
    localStorage.setItem(KEY, JSON.stringify(db));
    notify();
  }

  const readDoc = (path) => (db[path] ? { ...db[path], id: lastPart(path) } : null);
  const readQuery = (path, filters) => childrenOf(db, path)
    .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
    .map(([key, data]) => ({ ...data, id: lastPart(key) }));

  /** 跟 Firestore 一樣：先回一次目前的資料，之後每次有變動再回 */
  function watch(read, onData) {
    let active = true;
    const watcher = () => active && onData(read());
    watchers.add(watcher);
    queueMicrotask(watcher);
    return () => {
      active = false;
      watchers.delete(watcher);
    };
  }

  return {
    mode: "demo",
    user: () => user,
    async signIn() {
      user = role === "host"
        ? { uid: "demo-host", isAnonymous: false, email: null }
        : { uid: tabUid(), isAnonymous: true, email: null };
      return user;
    },
    async signOut() {
      user = null;
    },
    watchDoc: (path, onData) => watch(() => readDoc(path), onData),
    watchQuery: (path, filters, onData) => watch(() => readQuery(path, filters), onData),
    getDoc: async (path) => readDoc(path),
    getQuery: async (path, filters) => readQuery(path, filters),
    set: async (path, data) => commit({ ...db, [path]: resolve(data) }),
    async update(path, data) {
      if (!db[path]) throw new Error(`找不到 ${path}`);
      commit({ ...db, [path]: { ...db[path], ...resolve(data) } });
    },
    async remove(path) {
      const { [path]: _removed, ...rest } = db;
      commit(rest);
    },
  };
}
