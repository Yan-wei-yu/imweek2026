// firestore.rules 裡寫死的清單要跟網頁程式一致，不然會出現「網頁上能送、規則卻擋掉」的情況
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTIVITIES } from "../js/activities.js";
import { LIMITS, SESSIONS } from "../js/config.js";
import { DISCUSSIONS, POLL } from "../js/questions.js";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const list = (items) => `[${items.map((item) => `"${item}"`).join(", ")}]`;

test("場次清單一致", () => {
  assert.ok(rules.includes(`sid in ${list(SESSIONS)}`));
});

test("講者能切換的題目一致", () => {
  assert.ok(rules.includes(`activity in ${list(ACTIVITIES.map((item) => item.id))}`));
});

test("討論題號一致", () => {
  assert.ok(rules.includes(`topic in ${list(DISCUSSIONS.map((item) => item.id))}`));
});

test("每一種回答都只在對應的題目收得到", () => {
  const ids = new Set(ACTIVITIES.map((item) => item.id));
  for (const activity of ["poll", "cloud", "qa"]) {
    assert.ok(ids.has(activity), `activities.js 少了 ${activity}`);
    assert.ok(rules.includes(`activityIs(sid, "${activity}")`), `規則裡找不到 activityIs(sid, "${activity}")`);
  }
});

test("講者能隱藏文字雲、留言和問題", () => {
  const hideable = rules.match(/affectedKeys\(\)\.hasOnly\(\["hidden"/g) ?? [];
  assert.equal(hideable.length, 3);
});

test("投票選項數一致", () => {
  assert.ok(rules.includes(`choice <= ${POLL.options.length - 1}`));
});

test("每人則數一致（文件 ID 的編號範圍）", () => {
  for (const max of [LIMITS.words, LIMITS.comments, LIMITS.questions]) {
    assert.ok(rules.includes(`_[0-${max - 1}]`), `規則裡找不到 _[0-${max - 1}]`);
  }
});

test("字數上限是網頁上的兩倍（emoji 在規則裡可能算兩個字）", () => {
  assert.ok(rules.includes(`textOk(${LIMITS.wordLength * 2})`));
  assert.ok(rules.includes(`textOk(${LIMITS.commentLength * 2})`));
  assert.equal(LIMITS.commentLength, LIMITS.questionLength);
});
