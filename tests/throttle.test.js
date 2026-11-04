import { test } from "node:test";
import assert from "node:assert/strict";
import { createThrottle } from "../js/throttle.js";

/** 假的時鐘：時間只在 advance() 時往前走，到期的計時器照時間順序執行 */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      const due = [...timers].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.fn();
      }
    },
    pending: () => timers.size,
  };
}

function setup(gapMs = 3000) {
  const clock = fakeClock();
  const sent = [];
  const throttle = createThrottle({ gapMs, send: (value) => sent.push(value), clock });
  return { clock, sent, throttle };
}

test("createThrottle 第一次馬上送", () => {
  const { sent, throttle } = setup();
  throttle.push(1);
  assert.deepEqual(sent, [1]);
});

test("createThrottle 間隔內來的只留最新的，時間到再送", () => {
  const { clock, sent, throttle } = setup();
  throttle.push(1);
  clock.advance(500);
  throttle.push(2);
  clock.advance(500);
  throttle.push(3);
  assert.deepEqual(sent, [1]);
  clock.advance(2000);
  assert.deepEqual(sent, [1, 3]);
});

test("createThrottle 隔夠久之後再來的又馬上送", () => {
  const { clock, sent, throttle } = setup();
  throttle.push(1);
  clock.advance(3000);
  throttle.push(2);
  assert.deepEqual(sent, [1, 2]);
});

test("createThrottle 跟上一次送出的一樣就不送", () => {
  const { clock, sent, throttle } = setup();
  throttle.push({ counts: [1, 0] });
  clock.advance(5000);
  throttle.push({ counts: [1, 0] });
  throttle.push({ counts: [2, 0] });
  assert.deepEqual(sent, [{ counts: [1, 0] }, { counts: [2, 0] }]);
  // 間隔內先變了、又變回剛剛送出的樣子：時間到也不用再送
  throttle.push({ counts: [3, 0] });
  throttle.push({ counts: [2, 0] });
  clock.advance(3000);
  assert.equal(sent.length, 2);
});

test("createThrottle stop() 把還沒送的馬上送出去，之後不再送", () => {
  const { clock, sent, throttle } = setup();
  throttle.push(1);
  throttle.push(2);
  throttle.stop();
  assert.deepEqual(sent, [1, 2]);
  assert.equal(clock.pending(), 0);
  throttle.push(3);
  clock.advance(5000);
  assert.deepEqual(sent, [1, 2]);
});

test("createThrottle stop() 沒有待送的就什麼都不送", () => {
  const { sent, throttle } = setup();
  throttle.push(1);
  throttle.stop();
  assert.deepEqual(sent, [1]);
});
