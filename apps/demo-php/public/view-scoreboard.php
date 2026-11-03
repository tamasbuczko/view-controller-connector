<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
$code = isset($_GET['code']) ? strtoupper(trim((string) $_GET['code'])) : '';
$tatami = isset($_GET['tatami']) ? (string) $_GET['tatami'] : '';
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
    .board {
      text-align: center;
      padding: clamp(1rem, 4vh, 2.5rem) 1rem 2rem;
      min-height: 70vh;
      display: grid;
      align-content: center;
      gap: 0.35rem;
    }
    .board .vcc-live {
      letter-spacing: 0.16em;
      margin-bottom: 0.5rem;
    }
    .cat {
      font-family: var(--font-mono);
      font-size: clamp(0.75rem, 1.6vw, 1rem);
      opacity: 0.65;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .names {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: clamp(0.5rem, 2vw, 1.25rem);
      align-items: end;
      margin: 0.85rem 0 0.15rem;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(1.35rem, 4.5vw, 2.75rem);
      letter-spacing: -0.03em;
    }
    .aka { color: #c43c22; text-align: right; }
    .ao { color: #1d4f91; text-align: left; }
    .vs { opacity: 0.35; font-size: 0.7em; padding-bottom: 0.15em; }
    .score {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(4.5rem, 22vw, 9rem);
      letter-spacing: -0.05em;
      line-height: 0.95;
      margin-top: 0.35rem;
    }
    .clubs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      opacity: 0.55;
      font-size: clamp(0.8rem, 1.5vw, 1rem);
      margin-top: 0.25rem;
    }
    .pulse-line {
      height: 3px;
      width: min(14rem, 40vw);
      margin: 1rem auto 0;
      background: var(--vcc-signal);
      transform-origin: center;
      animation: board-pulse 2.4s ease-in-out infinite;
    }
    @keyframes board-pulse {
      50% { opacity: 0.35; transform: scaleX(0.85); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse-line { animation: none; }
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <?php require __DIR__ . '/partials/importmap.php'; ?>
  <script>
    window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
    window.__VCC_AUTO_CODE__ = <?= json_encode($code, JSON_UNESCAPED_UNICODE) ?>;
    window.__VCC_TATAMI__ = <?= json_encode($tatami, JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script type="module">
    import { createSession } from "/assets/core/index.js";
    import { mountView } from "/assets/ui/index.js";

    const content = document.createElement("div");
    content.className = "board";
    content.innerHTML = `<div class="vcc-live">SCOREBOARD</div>
      <div class="cat" id="cat">—</div>
      <div class="names">
        <div class="aka" id="aka-name">AKA</div>
        <div class="vs">vs</div>
        <div class="ao" id="ao-name">AO</div>
      </div>
      <div class="clubs">
        <div id="aka-club" style="text-align:right"></div>
        <div id="ao-club" style="text-align:left"></div>
      </div>
      <div class="score" id="score">0 — 0</div>
      <div class="pulse-line" aria-hidden="true"></div>`;

    const session = createSession(window.__VCC_CONFIG__);
    mountView(document.getElementById("app"), session, {
      title: "Scoreboard View",
      contentEl: content,
      autoJoinCode: window.__VCC_AUTO_CODE__ || undefined,
      kiosk: Boolean(window.__VCC_AUTO_CODE__),
    });

    function applyCompetitors(p) {
      if (!p) return;
      document.getElementById("aka-name").textContent = p.aka?.name ?? "AKA";
      document.getElementById("ao-name").textContent = p.ao?.name ?? "AO";
      document.getElementById("aka-club").textContent = p.aka?.club ?? "";
      document.getElementById("ao-club").textContent = p.ao?.club ?? "";
      if (p.categoryName) {
        document.getElementById("cat").textContent = p.categoryName;
      }
    }

    session.on("message", (m) => {
      if (m.name === "score.updated" && m.payload) {
        const p = m.payload;
        document.getElementById("score").textContent = `${p.aka ?? 0} — ${p.ao ?? 0}`;
      }
      if (m.name === "match.competitors" || m.name === "bout.state") {
        applyCompetitors(m.payload);
      }
    });

    async function pollHost() {
      const tatami = window.__VCC_TATAMI__;
      if (!tatami) return;
      try {
        const res = await fetch(`/comp/api/tatami.php?id=${encodeURIComponent(tatami)}`);
        const data = await res.json();
        if (!res.ok) return;
        const live = data.liveBout;
        if (live) {
          applyCompetitors({
            aka: live.aka,
            ao: live.ao,
            categoryName: live._categoryName,
          });
          if (live.score) {
            document.getElementById("score").textContent =
              `${live.score.aka ?? 0} — ${live.score.ao ?? 0}`;
          }
        }
      } catch {
        /* ignore */
      }
    }

    void pollHost();
    setInterval(() => void pollHost(), 2000);
  </script>
</body>
</html>
