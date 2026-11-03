<?php
declare(strict_types=1);
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verseny demó — Tatamik</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <link rel="stylesheet" href="/comp/comp.css" />
</head>
<body class="comp" data-theme="vcc-demo">
  <div class="comp-wrap">
    <nav class="comp-nav">
      <a href="/">VCC demó</a>
      <a href="/comp/">Verseny</a>
    </nav>
    <h1 class="comp-brand">Verseny demó</h1>
    <p class="comp-sub" id="event-name">Tesztadatok betöltése…</p>
    <div class="comp-actions" style="margin-bottom:1rem">
      <button type="button" class="secondary" id="reset-seed">Fixture reset</button>
    </div>
    <div class="comp-grid" id="tatamis"></div>
    <p class="comp-status" id="status"></p>
  </div>
  <script type="module">
    const statusEl = document.getElementById("status");
    const grid = document.getElementById("tatamis");

    async function load() {
      const res = await fetch("/comp/api/tatamis.php");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load failed");
      document.getElementById("event-name").textContent =
        `${data.event?.name ?? "Event"} · ${data.event?.id ?? ""}`;
      grid.innerHTML = "";
      for (const t of data.tatamis) {
        const a = document.createElement("a");
        a.className = "comp-card";
        a.href = `/comp/tatami.php?id=${encodeURIComponent(t.id)}`;
        const c = t.counts;
        a.innerHTML = `<h2>${escapeHtml(t.name)}</h2>
          <div class="comp-meta">vár: ${c.waiting} · élő: ${c.live} · kész: ${c.done} / ${c.total}</div>
          <div class="comp-meta" style="margin-top:.35rem">${t.sessionCode ? `kód ${t.sessionCode}` : "nincs session"}</div>`;
        grid.append(a);
      }
      statusEl.textContent = "";
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    document.getElementById("reset-seed").onclick = async () => {
      if (!confirm("Visszaállítod a seed fixturet? Session fájlok törlődnek.")) return;
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
