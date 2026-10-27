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
    .score { font-family: var(--font-display); font-size: clamp(4rem, 20vw, 8rem); letter-spacing: -0.04em; text-align: center; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script type="module">
    import { createSession } from "/assets/core/index.js";
    import { mountView } from "/assets/ui/index.js";

    const content = document.createElement("div");
    content.innerHTML = `<div class="vcc-live" style="text-align:center">SCOREBOARD</div>
      <div class="score" id="score">0 — 0</div>`;

    const session = createSession(window.__VCC_CONFIG__);
    mountView(document.getElementById("app"), session, {
      title: "Scoreboard View",
      contentEl: content,
    });

    session.on("message", (m) => {
      if (m.name === "score.updated" && m.payload) {
        const p = m.payload;
        document.getElementById("score").textContent = `${p.aka ?? 0} — ${p.ao ?? 0}`;
      }
    });
  </script>
</body>
</html>
