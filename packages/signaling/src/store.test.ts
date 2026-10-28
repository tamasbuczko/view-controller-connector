import assert from "node:assert/strict";
import { test } from "node:test";
import { Store } from "./store.js";

function fakeWs() {
  return { readyState: 1, send() {}, close() {} } as never;
}

test("single-use pair token TOKEN_CONSUMED on second use", () => {
  const store = new Store();
  const obs = store.addPeer(fakeWs());
  const room = store.createSession("1-1", obs);
  const token = store.mintPairToken(room, { type: "view", viewId: "v1" });
  const first = store.consumePairToken(room, token);
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.closedPairing, true);
  const second = store.consumePairToken(room, token);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "TOKEN_CONSUMED");
});

test("n-n pair token reusable", () => {
  const store = new Store();
  const obs = store.addPeer(fakeWs());
  const room = store.createSession("n-n", obs);
  const token = store.mintPairToken(room, { type: "group", groupId: "cameras" });
  assert.equal(store.consumePairToken(room, token).ok, true);
  assert.equal(store.consumePairToken(room, token).ok, true);
});
