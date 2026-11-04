// 限制寫入頻率：資料一直在變（例如投票陸續進來）時，最多每隔一段時間寫一次資料庫

/**
 * 第一次馬上送，之後最少隔 gapMs 才送下一次；間隔內來的只留最新的，時間到再送。
 * 跟上一次送出的內容一樣就不送。stop() 把還沒送的馬上送出去，之後不再送
 * @template T
 * @param {{ gapMs: number, send: (value: T) => void, keyOf?: (value: T) => string,
 *   clock?: { now: () => number, setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout } }} options
 * @returns {{ push: (value: T) => void, stop: () => void }}
 */
export function createThrottle({ gapMs, send, keyOf = JSON.stringify, clock }) {
  const now = clock ? () => clock.now() : () => Date.now();
  const schedule = clock ? (fn, ms) => clock.setTimeout(fn, ms) : (fn, ms) => setTimeout(fn, ms);
  const cancel = clock ? (id) => clock.clearTimeout(id) : (id) => clearTimeout(id);
  let lastAt = -Infinity;
  let lastKey = null;
  let latest;
  let hasPending = false;
  let timer = null;
  let stopped = false;

  function fire() {
    timer = null;
    if (!hasPending) return;
    hasPending = false;
    const key = keyOf(latest);
    if (key === lastKey) return;
    lastKey = key;
    lastAt = now();
    send(latest);
  }

  return {
    push(value) {
      if (stopped) return;
      latest = value;
      hasPending = true;
      if (timer !== null) return;
      const wait = lastAt + gapMs - now();
      if (wait <= 0) fire();
      else timer = schedule(fire, wait);
    },
    stop() {
      if (stopped) return;
      if (timer !== null) cancel(timer);
      fire();
      stopped = true;
    },
  };
}
