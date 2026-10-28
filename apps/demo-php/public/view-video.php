<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCC Video Ref</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>
    body { margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: .75rem; margin-top: 1rem; }
    video { width: 100%; background: #12140f; aspect-ratio: 16/9; object-fit: cover; }
    .bar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-top: 1rem; }
    .pip { width: 120px; aspect-ratio: 16/9; object-fit: cover; background: #12140f; }
    .rec { color: var(--vcc-live); font-family: var(--font-mono); font-size: .85rem; }
    .rec[data-on="1"]::before { content: "● "; animation: vcc-pulse 1.2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .rec[data-on="1"]::before { animation: none; }
    }
    @keyframes vcc-pulse { 50% { opacity: .35; } }
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
    content.innerHTML = `<div class="vcc-live" style="text-align:center">VIDEO REF</div>
      <div class="rec" id="rec" data-on="0">REC off</div>
      <div class="grid" id="tiles"></div>
      <div id="replay-host"></div>
      <div class="bar">
        <button type="button" class="vcc-btn" id="rec-start">REC start</button>
        <button type="button" class="vcc-btn secondary" id="rec-stop">REC stop</button>
        <button type="button" class="vcc-btn" id="replay6">Replay last 6s</button>
        <button type="button" class="vcc-btn secondary" id="slow">0.5×</button>
        <button type="button" class="vcc-btn secondary" id="rate1">1×</button>
        <button type="button" class="vcc-btn secondary" id="close-replay">Close replay</button>
      </div>`;

    const session = createSession(window.__VCC_CONFIG__);
    mountView(document.getElementById("app"), session, {
      title: "Video Ref View",
      contentEl: content,
    });

    const tiles = content.querySelector("#tiles");
    const recEl = content.querySelector("#rec");
    const replayHost = content.querySelector("#replay-host");
    const videos = new Map();
    let replay = null;

    session.on("recording", (e) => {
      recEl.dataset.on = e.active ? "1" : "0";
      recEl.textContent = e.active ? "REC" : "REC off";
    });

    session.on("track", (e) => {
      let video = videos.get(e.publicationId);
      if (!video) {
        video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.dataset.pub = e.publicationId;
        tiles.append(video);
        videos.set(e.publicationId, video);
      }
      video.srcObject = e.stream;
    });

    session.on("trackEnded", (publicationId) => {
      const video = videos.get(publicationId);
      if (video) {
        video.srcObject = null;
        video.remove();
        videos.delete(publicationId);
      }
    });

    content.querySelector("#rec-start").onclick = () => {
      void session.startLocalRecording({ windowSeconds: 30 });
    };
    content.querySelector("#rec-stop").onclick = () => {
      void session.stopLocalRecording();
    };
    content.querySelector("#replay6").onclick = async () => {
      if (replay) replay.close();
      replay = await session.openReplay({ lastSeconds: 6 });
      const el = replay.getElement();
      if (!el) return;
      el.className = "pip";
      el.muted = true;
      el.controls = true;
      replayHost.replaceChildren(el);
      // Shrink live tiles visually while replaying
      tiles.style.maxWidth = "140px";
      replay.play();
    };
    content.querySelector("#slow").onclick = () => replay?.setRate(0.5);
    content.querySelector("#rate1").onclick = () => replay?.setRate(1);
    content.querySelector("#close-replay").onclick = () => {
      replay?.close();
      replay = null;
      replayHost.replaceChildren();
      tiles.style.maxWidth = "";
    };
  </script>
</body>
</html>

