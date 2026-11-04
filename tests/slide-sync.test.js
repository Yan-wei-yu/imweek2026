import { test } from "node:test";
import assert from "node:assert/strict";
import { deckOf, sameSession, sessionFor, slideImage } from "../js/slide-sync.js";

const DECKS = {
  s1: { title: "第一節", file: "第一節_職涯與成長.pptx", count: 22 },
  s2: { title: "第二節", file: "第二節_在LuxCreo怎麼做開發.pptx", count: 0 },
  s3: { title: "第三節", file: "第三節_一起討論.pptx", count: 14 },
};
const ACTIVITIES = { s3: { 3: "poll", 13: "qa" } };

test("deckOf 用 PowerPoint 的檔名找簡報代號，不認得的回傳 null", () => {
  assert.equal(deckOf("第三節_一起討論.pptx", DECKS), "s3");
  assert.equal(deckOf("別的簡報.pptx", DECKS), null);
  assert.equal(deckOf(undefined, DECKS), null);
});

test("sessionFor 一般頁是「投影片」，互動題那幾頁切成對應的題目", () => {
  assert.deepEqual(sessionFor({ running: true, file: "第一節_職涯與成長.pptx", index: 5 }, DECKS, ACTIVITIES),
    { activity: "slides", slide: { deck: "s1", index: 5 } });
  assert.deepEqual(sessionFor({ running: true, file: "第三節_一起討論.pptx", index: 3 }, DECKS, ACTIVITIES),
    { activity: "poll", slide: { deck: "s3", index: 3 } });
});

test("sessionFor 沒在放映、不認得的簡報、頁數不合理時回傳 null（維持原狀）", () => {
  assert.equal(sessionFor({ running: false }, DECKS, ACTIVITIES), null);
  assert.equal(sessionFor(null, DECKS, ACTIVITIES), null);
  assert.equal(sessionFor({ running: true, file: "別的.pptx", index: 2 }, DECKS, ACTIVITIES), null);
  assert.equal(sessionFor({ running: true, file: "第一節_職涯與成長.pptx", index: 0 }, DECKS, ACTIVITIES), null);
  assert.equal(sessionFor({ running: true, file: "第一節_職涯與成長.pptx", index: "3" }, DECKS, ACTIVITIES), null);
});

test("sameSession 題目和頁數都一樣才算一樣", () => {
  const a = { activity: "slides", slide: { deck: "s1", index: 5 } };
  assert.equal(sameSession(a, { activity: "slides", slide: { deck: "s1", index: 5 } }), true);
  assert.equal(sameSession(a, { activity: "slides", slide: { deck: "s1", index: 6 } }), false);
  assert.equal(sameSession(a, { activity: "poll", slide: { deck: "s1", index: 5 } }), false);
  assert.equal(sameSession(a, null), false);
});

test("slideImage 帶上匯出版本，重新匯出後手機不會拿到快取裡的舊圖", () => {
  assert.equal(slideImage(DECKS, "s1", 4, "20261104-1652"), "slides/s1/04.webp?v=20261104-1652");
});

test("slideImage 給圖片網址；不公開的簡報或超出範圍回傳 null", () => {
  assert.equal(slideImage(DECKS, "s1", 4), "slides/s1/04.webp");
  assert.equal(slideImage(DECKS, "s3", 14), "slides/s3/14.webp");
  assert.equal(slideImage(DECKS, "s3", 15), null);
  assert.equal(slideImage(DECKS, "s2", 1), null);
  assert.equal(slideImage(DECKS, "s9", 1), null);
});
