import assert from "node:assert/strict";
import { test } from "node:test";
import { canKick, ConflictBoard } from "./conflict.js";

test("canKick respects disconnectPolicy", () => {
  assert.equal(canKick("observer-only", "observer"), true);
  assert.equal(canKick("observer-only", "view"), false);
  assert.equal(canKick("observer+view", "view"), true);
  assert.equal(canKick("observer+view+self-leave", "controller"), false);
});

test("ConflictBoard last-write-wins always claims", () => {
  const b = new ConflictBoard();
  assert.equal(b.tryClaim("score.updated", "last-write-wins", "a").ok, true);
  assert.equal(b.tryClaim("score.updated", "last-write-wins", "b").ok, true);
});

test("ConflictBoard active-lock blocks second peer", () => {
  const b = new ConflictBoard();
  assert.equal(b.tryClaim("x", "active-lock", "a").ok, true);
  const second = b.tryClaim("x", "active-lock", "b");
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.winnerPeerId, "a");
  b.release("x", "a", "active-lock");
  assert.equal(b.tryClaim("x", "active-lock", "b").ok, true);
});

test("ConflictBoard media-exclusive", () => {
  const b = new ConflictBoard();
  assert.equal(b.tryClaim("camera.live", "media-exclusive", "cam1").ok, true);
  const denied = b.tryClaim("camera.live", "media-exclusive", "cam2");
  assert.equal(denied.ok, false);
});
