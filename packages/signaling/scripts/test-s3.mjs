/**
 * S3 automated scenarios T1–T4 against a running signaling server.
 * Usage: node scripts/test-s3.mjs [ws://127.0.0.1:8787]
 */
import WebSocket from "ws";

const URL = process.argv[2] ?? "ws://127.0.0.1:8787";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function ok(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function fail(name, err) {
  failed += 1;
  console.error(`  FAIL  ${name}: ${err?.message ?? err}`);
}

class Client {
  constructor(label) {
    this.label = label;
    this.ws = null;
    this.peerId = null;
    this.pending = new Map();
    this.events = [];
    this.seq = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
      this.ws.on("message", (raw) => {
        const msg = JSON.parse(String(raw));
        this.events.push(msg);
        if (msg.type === "welcome") this.peerId = msg.peerId;
        if (msg.reqId && this.pending.has(msg.reqId)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.reqId);
          this.pending.delete(msg.reqId);
          if (msg.type === "error") {
            const e = new Error(msg.message ?? msg.code);
            e.code = msg.code;
            rej(e);
          } else res(msg);
        }
      });
    });
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }

  request(type, body = {}) {
    const reqId = `t${++this.seq}`;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.ws.send(JSON.stringify({ type, reqId, ...body }));
      setTimeout(() => {
        if (this.pending.has(reqId)) {
          this.pending.delete(reqId);
          reject(new Error(`timeout ${type}`));
        }
      }, 8_000);
    });
  }

  waitFor(pred, ms = 4_000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        const hit = this.events.find(pred);
        if (hit) return resolve(hit);
        if (Date.now() - start > ms) {
          return reject(new Error("waitFor timeout"));
        }
        setTimeout(tick, 40);
      };
      tick();
    });
  }

  clearEvents() {
    this.events = [];
  }
}

async function setupSession(mode) {
  const observer = new Client("obs");
  await observer.connect();
  await observer.waitFor((m) => m.type === "welcome");
  const created = await observer.request("session.create", { mode });
  return { observer, created };
}

async function joinView(code) {
  const view = new Client("view");
  await view.connect();
  await view.waitFor((m) => m.type === "welcome");
  const joined = await view.request("session.join", { code, role: "view" });
  return { view, joined };
}

async function mint(observer, sessionId, target) {
  const res = await observer.request("pairing.mint", { sessionId, target });
  return res.payload;
}

/** T1 — 1-1 single-use token + pairing.closed */
async function t1() {
  const { observer, created } = await setupSession("1-1");
  const { view } = await joinView(created.sessionCode);
  const payload = await mint(observer, created.sessionId, {
    type: "view",
    viewId: view.peerId,
  });

  observer.clearEvents();
  const c1 = new Client("c1");
  await c1.connect();
  await c1.waitFor((m) => m.type === "welcome");
  const j1 = await c1.request("session.join", {
    pairToken: payload.pairToken,
    role: "controller",
    target: payload.target,
  });
  assert(j1.type === "session.joined", "c1 should join");
  const links = j1.topology.links.filter((l) => l.controllerId === c1.peerId);
  assert(links.length === 1, "expected 1 link");

  await observer.waitFor((m) => m.type === "pairing.closed");

  const c2 = new Client("c2");
  await c2.connect();
  await c2.waitFor((m) => m.type === "welcome");
  let consumed = false;
  try {
    await c2.request("session.join", {
      pairToken: payload.pairToken,
      role: "controller",
      target: payload.target,
    });
  } catch (e) {
    consumed = e.code === "TOKEN_CONSUMED";
  }
  assert(consumed, "second controller must get TOKEN_CONSUMED");

  for (const c of [observer, view, c1, c2]) c.close();
}

/** T2 — 1-n group token, one controller → 2 links, then TOKEN_CONSUMED */
async function t2() {
  const { observer, created } = await setupSession("1-n");
  const v1 = await joinView(created.sessionCode);
  const v2 = await joinView(created.sessionCode);
  await observer.request("group.define", {
    sessionId: created.sessionId,
    groupId: "cameras",
    memberIds: [v1.view.peerId, v2.view.peerId],
  });
  const payload = await mint(observer, created.sessionId, {
    type: "group",
    groupId: "cameras",
  });

  observer.clearEvents();
  const c1 = new Client("c1");
  await c1.connect();
  await c1.waitFor((m) => m.type === "welcome");
  const j1 = await c1.request("session.join", {
    pairToken: payload.pairToken,
    role: "controller",
  });
  const links = j1.topology.links.filter((l) => l.controllerId === c1.peerId);
  assert(links.length === 2, `expected 2 links, got ${links.length}`);
  await observer.waitFor((m) => m.type === "pairing.closed");

  const c2 = new Client("c2");
  await c2.connect();
  await c2.waitFor((m) => m.type === "welcome");
  let consumed = false;
  try {
    await c2.request("session.join", {
      pairToken: payload.pairToken,
      role: "controller",
    });
  } catch (e) {
    consumed = e.code === "TOKEN_CONSUMED";
  }
  assert(consumed, "second controller TOKEN_CONSUMED");

  for (const c of [observer, v1.view, v2.view, c1, c2]) c.close();
}

/** T3 — n-1 reusable QR; two controllers → two links; no pairing.closed */
async function t3() {
  const { observer, created } = await setupSession("n-1");
  const { view } = await joinView(created.sessionCode);
  const payload = await mint(observer, created.sessionId, {
    type: "view",
    viewId: view.peerId,
  });

  observer.clearEvents();
  const c1 = new Client("c1");
  await c1.connect();
  await c1.waitFor((m) => m.type === "welcome");
  await c1.request("session.join", {
    pairToken: payload.pairToken,
    role: "controller",
  });

  const c2 = new Client("c2");
  await c2.connect();
  await c2.waitFor((m) => m.type === "welcome");
  const j2 = await c2.request("session.join", {
    pairToken: payload.pairToken,
    role: "controller",
  });
  const links = j2.topology.links.filter(
    (l) => l.viewId === view.peerId,
  );
  assert(links.length === 2, `expected 2 links to view, got ${links.length}`);

  const closed = observer.events.some((m) => m.type === "pairing.closed");
  assert(!closed, "n-1 must not broadcast pairing.closed");

  // remint + hide/show path: mint again while first token still valid
  const payload2 = await mint(observer, created.sessionId, {
    type: "view",
    viewId: view.peerId,
  });
  assert(payload2.pairToken !== payload.pairToken, "fresh mint token");

  for (const c of [observer, view, c1, c2]) c.close();
}

/** T4 — n-n group + multi controller; no pairing.closed; topology OK */
async function t4() {
  const { observer, created } = await setupSession("n-n");
  const v1 = await joinView(created.sessionCode);
  const v2 = await joinView(created.sessionCode);
  await observer.request("group.define", {
    sessionId: created.sessionId,
    groupId: "cameras",
    memberIds: [v1.view.peerId, v2.view.peerId],
  });
  const payload = await mint(observer, created.sessionId, {
    type: "group",
    groupId: "cameras",
  });

  // View can mint too
  const viewMint = await v1.view.request("pairing.mint", {
    sessionId: created.sessionId,
    target: { type: "view", viewId: v1.view.peerId },
  });
  assert(viewMint.payload?.pairToken, "view can mint");

  observer.clearEvents();
  const c1 = new Client("c1");
  await c1.connect();
  await c1.waitFor((m) => m.type === "welcome");
  await c1.request("session.join", {
    pairToken: payload.pairToken,
    role: "controller",
  });

  const c2 = new Client("c2");
  await c2.connect();
  await c2.waitFor((m) => m.type === "welcome");
  const j2 = await c2.request("session.join", {
    pairToken: payload.pairToken,
    role: "controller",
  });

  const c1Links = j2.topology.links.filter((l) => l.controllerId === c1.peerId);
  const c2Links = j2.topology.links.filter((l) => l.controllerId === c2.peerId);
  assert(c1Links.length === 2, "c1 → 2 views");
  assert(c2Links.length === 2, "c2 → 2 views");

  const closed = observer.events.some((m) => m.type === "pairing.closed");
  assert(!closed, "n-n must not broadcast pairing.closed");

  for (const c of [observer, v1.view, v2.view, c1, c2]) c.close();
}

async function main() {
  console.log(`S3 tests → ${URL}\n`);
  const cases = [
    ["T1 1-1 single-use + pairing.closed", t1],
    ["T2 1-n group + TOKEN_CONSUMED", t2],
    ["T3 n-1 reusable multi-controller", t3],
    ["T4 n-n group multi-controller", t4],
  ];
  for (const [name, fn] of cases) {
    try {
      await fn();
      ok(name);
    } catch (e) {
      fail(name, e);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
