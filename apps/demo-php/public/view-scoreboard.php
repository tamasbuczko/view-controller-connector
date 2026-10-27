<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCC Scoreboard</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>
    body { margin: 0; }
    .board { min-height: 100vh; display: grid; place-content: center; gap: 1rem; text-align: center; padding: 1.5rem; }
    .score { font-family: var(--font-display); font-size: clamp(4rem, 20vw, 8rem); letter-spacing: -0.04em; }
    input, button { font: inherit; padding: .6rem .9rem; border-radius: 2px; border: 1px solid var(--vcc-ink); }
  </style>
</head>
<body data-theme="vcc-demo">
  <main class="board">
    <div class="vcc-brand">VCC</div>
    <div class="vcc-live">SCOREBOARD VIEW</div>
    <div class="score" id="score">0 — 0</div>
    <div id="status">Várakozik a session kódra…</div>
    <div>
      <input id="code" placeholder="SESSION KÓD" maxlength="8" style="text-transform:uppercase;font-family:var(--font-mono)" />
      <button type="button" id="join">Csatlakozás</button>
    </div>
  </main>
  <script>
    window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script type="module">
    import { createSession } from "/assets/core/index.js";
    const session = createSession(window.__VCC_CONFIG__);
    const status = document.getElementById("status");
    const score = document.getElementById("score");

    session.on("message", (m) => {
      if (m.name === "score.updated" && m.payload) {
        const p = m.payload;
        score.textContent = `${p.aka ?? 0} — ${p.ao ?? 0}`;
      }
    });
    session.on("error", (e) => { status.textContent = `${e.code}: ${e.message}`; });

    document.getElementById("join").onclick = async () => {
      const code = document.getElementById("code").value.trim();
      await session.prepare();
      await session.joinWithCode(code, "view");
      status.textContent = `Kapcsolódva · peer ${session.peerId}`;
    };
  </script>
</body>
</html>
