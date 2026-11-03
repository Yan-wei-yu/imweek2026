import { test } from "node:test";
import assert from "node:assert/strict";
import { charCount, cleanText, displayWord, textProblem, wordKey } from "../js/text.js";

test("cleanText 去掉頭尾空白，換行和連續空白縮成一個空格", () => {
  assert.equal(cleanText("  我覺得\n\n  AI   很好用  "), "我覺得 AI 很好用");
});

test("cleanText 遇到不是字串的值回傳空字串", () => {
  assert.equal(cleanText(undefined), "");
  assert.equal(cleanText(42), "");
});

test("charCount 把 emoji 和中文都算成一個字", () => {
  assert.equal(charCount("好用🤖"), 3);
});

test("textProblem 分得出空白和太長", () => {
  assert.equal(textProblem("", 12), "empty");
  assert.equal(textProblem("一二三四五六七八九十一二三", 12), "long");
  assert.equal(textProblem("一二三四五六七八九十一二", 12), null);
  assert.equal(textProblem("🤖".repeat(12), 12), null);
});

test("displayWord 去掉頭尾的標點，保留原本的大小寫", () => {
  assert.equal(displayWord("「好用」"), "好用");
  assert.equal(displayWord(" AI！ "), "AI");
});

test("wordKey 不分全形半形、大小寫，也不管頭尾標點", () => {
  assert.equal(wordKey("ＡＩ"), "ai");
  assert.equal(wordKey(" Ai！"), "ai");
  assert.equal(wordKey("「好用」"), "好用");
});

test("wordKey 只有標點或空白時是空字串，emoji 保留", () => {
  assert.equal(wordKey("！？"), "");
  assert.equal(wordKey("   "), "");
  assert.equal(wordKey("🤖"), "🤖");
});
