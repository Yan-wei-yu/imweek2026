import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSlot, paths } from "../js/store-common.js";
import { currentSession, SESSIONS } from "../js/config.js";

test("paths 把每一種資料放在同一場活動底下", () => {
  const p = paths("rehearsal");
  assert.equal(p.session, "sessions/rehearsal");
  assert.equal(p.poll, "sessions/rehearsal/poll");
  assert.equal(p.votes, "sessions/rehearsal/votes");
  assert.equal(p.pollResults, "sessions/rehearsal/results/poll");
});

test("nextSlot 回傳還沒用過的最小編號，用完了回傳 null", () => {
  assert.equal(nextSlot([], "u1_", 3), 0);
  assert.equal(nextSlot(["u1_0", "u1_2"], "u1_", 3), 1);
  assert.equal(nextSlot(["u1_0", "u1_1", "u1_2"], "u1_", 3), null);
  assert.equal(nextSlot(["u2_0"], "u1_", 3), 0);
});

test("currentSession 只認名單上的場次，其他都當正式場", () => {
  assert.equal(currentSession("?s=rehearsal"), "rehearsal");
  assert.equal(currentSession("?s=../../hack"), SESSIONS[0]);
  assert.equal(currentSession(""), SESSIONS[0]);
});
