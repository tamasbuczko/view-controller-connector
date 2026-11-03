/**
 * Smoke test: competition fixture API (PHP must listen on :8080).
 */
const base = process.env.VCC_DEMO_URL ?? "http://127.0.0.1:8080";

async function json(path, init) {
  const res = await fetch(`${base}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${body.error || res.statusText}`);
  }
  return body;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const results = [];
function pass(name) {
  results.push({ name, ok: true });
  console.log(`  PASS  ${name}`);
}

try {
  console.log(`Comp API tests → ${base}`);

  await json("/comp/api/bout-action.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset-seed" }),
  });
  pass("reset-seed");

  const list = await json("/comp/api/tatamis.php");
  assert(list.tatamis?.length === 3, "expected 3 tatamis");
  assert(list.event?.id, "event id");
  pass("tatamis list");

  const t1 = await json("/comp/api/tatami.php?id=t1");
  assert(t1.bouts?.length >= 3, "t1 bouts");
  assert(t1.nextWaiting?.status === "waiting", "next waiting");
  pass("tatami detail");

  await json("/comp/api/session.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tatamiId: "t1",
      sessionCode: "TEST01",
      sessionId: "sess_test",
    }),
  });
  const t1b = await json("/comp/api/tatami.php?id=t1");
  assert(t1b.session?.sessionCode === "TEST01", "session persist");
  pass("session persist");

  const started = await json("/comp/api/bout-action.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", tatamiId: "t1" }),
  });
  assert(started.bout?.status === "live", "bout live");
  assert(started.competitors?.aka?.name, "competitors");
  pass("bout start");

  await json("/comp/api/bout-action.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "score",
      tatamiId: "t1",
      aka: 2,
      ao: 1,
    }),
  });
  const scored = await json("/comp/api/tatami.php?id=t1");
  assert(scored.liveBout?.score?.aka === 2, "score aka");
  pass("bout score");

  const next = await json("/comp/api/bout-action.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "next",
      tatamiId: "t1",
      aka: 2,
      ao: 1,
    }),
  });
  assert(next.done === false, "next not done");
  assert(next.bout?.status === "live", "next live");
  pass("bout next");

  const home = await fetch(`${base}/comp/`);
  assert(home.ok, "comp index html");
  const html = await home.text();
  assert(html.includes("comp-brand"), "comp branding");
  pass("comp index html");

  const desk = await fetch(`${base}/comp/tatami.php?id=t1`);
  assert(desk.ok, "desk html");
  pass("comp desk html");

  console.log(`\n${results.length} passed, 0 failed`);
} catch (e) {
  console.error(`\nFAIL  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
