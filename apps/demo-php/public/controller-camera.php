<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCC Camera Controller</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>
    body { margin: 0; }
    .wrap { max-width: 480px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1rem; }
    input, button { font: inherit; padding: .65rem .9rem; border-radius: 2px; border: 1px solid var(--vcc-ink); }
    video { width: 100%; background: #12140f; aspect-ratio: 16/9; object-fit: cover; }
  </style>
</head>
<body data-theme="vcc-demo">
  <main class="wrap">
    <div class="vcc-brand" style="font-size:1.75rem">VCC</div>
    <div class="vcc-live">CAMERA CONTROLLER</div>
    <div id="status">Session kód</div>
    <input id="code" placeholder="SESSION KÓD" maxlength="8" style="text-transform:uppercase;font-family:var(--font-mono)" />
    <button type="button" class="vcc-btn" id="join">Csatlakozás</button>
    <button type="button" class="vcc-btn" id="start" disabled>Kamera start</button>
    <button type="button" class="vcc-btn secondary" id="stop" disabled>Stop</button>
    <video id="preview" autoplay playsinline muted></video>
  </main>
  <script>
    window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script type="module">
    import { createSession } from "/assets/core/index.js";
    const session = createSession(window.__VCC_CONFIG__);
    const status = document.getElementById("status");
    const preview = document.getElementById("preview");
    let publication = null;

    session.on("error", (e) => { status.textContent = `${e.code}: ${e.message}`; });

    document.getElementById("join").onclick = async () => {
      const code = document.getElementById("code").value.trim();
      await session.prepare();
      await session.joinWithCode(code, "controller");
      status.textContent = `Kapcsolódva · peer ${session.peerId}`;
      document.getElementById("start").disabled = false;
    };

    document.getElementById("start").onclick = async () => {
      try {
        publication = await session.publishMedia({ kind: "camera", label: "main" });
        if (publication.stream) preview.srcObject = publication.stream;
        status.textContent = `LIVE · ${publication.id}`;
        document.getElementById("stop").disabled = false;
        document.getElementById("start").disabled = true;
      } catch (e) {
        status.textContent = `${e.code ?? "ERR"}: ${e.message ?? e}`;
      }
    };

    document.getElementById("stop").onclick = async () => {
      if (publication) {
        await publication.stop();
        publication = null;
      }
      preview.srcObject = null;
      status.textContent = "Stopped";
      document.getElementById("start").disabled = false;
      document.getElementById("stop").disabled = true;
    };
  </script>
</body>
</html>
