import assert from "node:assert/strict";
import { test } from "node:test";
import { maskSecret, summarizeMsg } from "./log.js";

test("maskSecret hides middle", () => {
  const m = maskSecret("abcdefghijklmnop");
  assert.ok(m.includes("…"));
  assert.ok(!m.includes("efghijkl"));
});

test("summarizeMsg masks pairToken", () => {
  const s = summarizeMsg({
    type: "session.join",
    pairToken: "supersecrettokenvalue",
  });
  assert.ok(s.includes("pairToken="));
  assert.ok(!s.includes("supersecrettokenvalue"));
});
