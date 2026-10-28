import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowsPersistentQr,
  parsePairUri,
  shouldHideQrAfterPair,
} from "./pairing.js";

test("shouldHideQrAfterPair for single-use modes", () => {
  assert.equal(shouldHideQrAfterPair("1-1"), true);
  assert.equal(shouldHideQrAfterPair("1-n"), true);
  assert.equal(shouldHideQrAfterPair("n-1"), false);
  assert.equal(shouldHideQrAfterPair("n-n"), false);
});

test("allowsPersistentQr", () => {
  assert.equal(allowsPersistentQr("n-n"), true);
  assert.equal(allowsPersistentQr("1-1"), false);
});

test("parsePairUri round-trip fields", () => {
  const uri =
    "vcc://pair?s=sid1&target=view%3Av1&t=tok&sig=ws%3A%2F%2F127.0.0.1%3A8787&mode=n-n";
  const p = parsePairUri(uri);
  assert.ok(p);
  assert.equal(p!.sessionId, "sid1");
  assert.equal(p!.pairToken, "tok");
  assert.equal(p!.mode, "n-n");
  assert.deepEqual(p!.target, { type: "view", viewId: "v1" });
});

test("parsePairUri rejects garbage", () => {
  assert.equal(parsePairUri("http://example.com"), null);
});
