// 跟著看簡報：在 Worker 裡定時問同步小程式 PowerPoint 播到哪，把結果交給講者頁。
// 講者頁被 PowerPoint 全螢幕蓋住時，瀏覽器會把頁面裡的計時器降到一分鐘一次；Worker 裡的計時器不受影響
self.addEventListener("message", ({ data: { url, interval, timeout } }) => {
  const tick = async () => {
    let state = null;
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeout) });
      state = response.ok ? await response.json() : null;
    } catch {
      state = null; // 沒回應或逾時：講者頁會顯示「同步程式沒有回應」
    }
    self.postMessage(state);
    setTimeout(tick, interval);
  };
  tick();
}, { once: true });
