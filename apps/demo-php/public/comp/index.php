<?php
declare(strict_types=1);
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCC Verseny</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <link rel="stylesheet" href="/comp/comp.css" />
</head>
<body class="comp" data-theme="vcc-demo">
  <div class="comp-wrap">
    <nav class="comp-nav">
      <a href="/">VCC</a>
      <a href="/comp/" aria-current="page">Verseny</a>
    </nav>

    <header class="comp-hero">
      <p class="comp-eyebrow">Live venue</p>
      <h1 class="comp-brand">VCC</h1>
      <p class="comp-sub" id="event-name">Tatami választás. Egy mat — egy session.</p>
      <div class="comp-live-line" id="live-line"></div>
      <div class="comp-toolbar">
        <button type="button" class="comp-btn secondary" id="reset-seed">Fixture reset</button>
      </div>
    </header>

    <div class="comp-mat-list" id="tatamis"></div>
    <p class="comp-status" id="status"></p>
  </div>
  <script type="module">
    const statusEl = document.getElementById("status");
    const grid = document.getElementById("tatamis");
    const liveLine = document.getElementById("live-line");

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    async function load() {
      const res = await fetch("/comp/api/tatamis.php");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load failed");
      document.getElementById("event-name").textContent =
        `${data.event?.name ?? "Event"} — válassz tatamit`;
      grid.innerHTML = "";
      for (const t of data.tatamis) {
        const a = document.createElement("a");
        a.className = "comp-mat";
        a.href = `/comp/tatami.php?id=${encodeURIComponent(t.id)}`;
        const c = t.counts;
        const sess = t.sessionCode
          ? `session ${t.sessionCode}`
          : "session nincs";
        a.innerHTML = `<div>
            <h2>${escapeHtml(t.name)}</h2>
            <div class="comp-mat-meta">${c.waiting} vár · ${c.live} élő · ${c.done} kész · ${escapeHtml(sess)}</div>
          </div>
          <div class="comp-mat-go">Megnyitás</div>`;
        grid.append(a);
      }
      requestAnimationFrame(() => liveLine.classList.add("is-on"));
      statusEl.textContent = "";
    }

    document.getElementById("reset-seed").onclick = async () => {
      if (!confirm("Seed visszaállítás? Session fájlok törlődnek.")) return;
      statusEl.textContent = "Reset…";
      const res = await fetch("/comp/api/bout-action.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-seed" }),
      });
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.error || "reset failed";
        return;
      }
      await load();
      statusEl.textContent = "Fixture reset OK";
    };

    load().catch((e) => {
      statusEl.textContent = String(e.message || e);
    });
  </script>
</body>
</html>
