<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCC Score Controller</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>
    body { margin: 0; }
    .wrap { max-width: 420px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .aka { background: #c43c22; color: #fff; border: 0; padding: 1.5rem; font-size: 1.25rem; border-radius: 2px; }
    .ao { background: #1d4f91; color: #fff; border: 0; padding: 1.5rem; font-size: 1.25rem; border-radius: 2px; }
    input, textarea, .join { font: inherit; padding: .65rem .9rem; border-radius: 2px; border: 1px solid var(--vcc-ink); width: 100%; box-sizing: border-box; }
    textarea { min-height: 4.5rem; font-family: var(--font-mono); font-size: .75rem; }
  </style>
</head>
<body data-theme="vcc-demo">
  <main class="wrap">
    <div class="vcc-brand" style="font-size:1.75rem">VCC</div>
    <div class="vcc-live">SCORE CONTROLLER</div>
    <div id="status">Kód vagy pair URI</div>
    <input id="code" placeholder="SESSION KÓD (opcionális)" maxlength="8" style="text-transform:uppercase;font-family:var(--font-mono)" />
    <textarea id="uri" placeholder="vcc://pair?... (QR URI)"></textarea>
    <button type="button" class="join vcc-btn" id="join-code">Csatlakozás kóddal</button>
    <button type="button" class="join vcc-btn secondary" id="join-uri">Csatlakozás pair URI-val</button>
    <div class="row">
      <button type="button" class="aka" data-side="aka">AKA +1</button>
      <button type="button" class="ao" data-side="ao">AO +1</button>
    </div>
    <div id="score">0 — 0</div>
  </main>
  <script>
    window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script type="module">
    import { createSession, parsePairUri } from "/assets/core/index.js";
    const session = createSession(window.__VCC_CONFIG__);
    const state = { aka: 0, ao: 0 };
    const status = document.getElementById("status");
    const score = document.getElementById("score");

    session.on("error", (e) => { status.textContent = `${e.code}: ${e.message}`; });

    async function pushScore() {
      score.textContent = `${state.aka} — ${state.ao}`;
      await session.send({
        name: "score.updated",
        to: "*",
        payload: { ...state },
      });
    }

    document.getElementById("join-code").onclick = async () => {
      const code = document.getElementById("code").value.trim();
      await session.prepare();
      await session.joinWithCode(code, "controller");
      status.textContent = `Kapcsolódva (kód) · peer ${session.peerId}`;
    };

    document.getElementById("join-uri").onclick = async () => {
      const raw = document.getElementById("uri").value.trim();
      const payload = parsePairUri(raw);
      if (!payload) {
        status.textContent = "Érvénytelen pair URI";
        return;
      }
      await session.prepare();
      await session.joinWithPairToken(payload);
      status.textContent = `Kapcsolódva (pair) · peer ${session.peerId}`;
    };

    document.querySelectorAll("[data-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = btn.getAttribute("data-side");
        state[side] += 1;
        void pushScore();
      });
    });
  </script>
</body>
</html>
