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
  <title>VCC Video Ref</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>
    body { margin: 0; }
    .ref-layout {
      display: grid;
      gap: .75rem;
      margin-top: .5rem;
    }
    .ref-layout.reviewing {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      align-items: start;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: .5rem;
    }
    .grid video {
      width: 100%;
      background: #12140f;
      aspect-ratio: 16/9;
      object-fit: cover;
    }
    .replay-stage {
      min-height: 0;
      background: #0a0b09;
      border: 1px solid color-mix(in srgb, var(--vcc-ink) 18%, transparent);
    }
    .replay-stage video {
      width: 100%;
      max-height: min(70vh, 720px);
      aspect-ratio: 16/9;
      object-fit: contain;
      background: #12140f;
      display: block;
    }
    .bar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-top: .75rem; }
    .rec { color: var(--vcc-live); font-family: var(--font-mono); font-size: .85rem; }
    .rec[data-on="1"]::before { content: "● "; animation: vcc-pulse 1.2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .rec[data-on="1"]::before { animation: none; }
    }
    @keyframes vcc-pulse { 50% { opacity: .35; } }
    @media (max-width: 900px) {
      .ref-layout.reviewing { grid-template-columns: 1fr; }
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
    content.innerHTML = `<div class="vcc-live" style="text-align:center">VIDEO REF</div>
      <div class="rec" id="rec" data-on="0">REC off</div>
      <div class="ref-layout" id="layout">
        <div class="grid" id="tiles"></div>
        <div class="replay-stage" id="replay-host" hidden></div>
      </div>
      <div class="bar">
        <button type="button" class="vcc-btn" id="rec-start">REC start</button>
        <button type="button" class="vcc-btn secondary" id="rec-stop">REC stop</button>
        <button type="button" class="vcc-btn" id="replay6">Replay 6s</button>
        <button type="button" class="vcc-btn" id="replay10">Replay 10s</button>
        <button type="button" class="vcc-btn secondary" id="slow">0.5×</button>
        <button type="button" class="vcc-btn secondary" id="rate1">1×</button>
        <button type="button" class="vcc-btn secondary" id="export10">Export 10s</button>
        <button type="button" class="vcc-btn secondary" id="close-replay">Close replay</button>
      </div>`;

    const session = createSession(window.__VCC_CONFIG__);
    mountView(document.getElementById("app"), session, {
      title: "Video Ref View",
      contentEl: content,
      autoJoinCode: window.__VCC_AUTO_CODE__ || undefined,
    });

    const layout = content.querySelector("#layout");
    const tiles = content.querySelector("#tiles");
    const recEl = content.querySelector("#rec");
    const replayHost = content.querySelector("#replay-host");
    const videos = new Map();
    let replay = null;
    let recStarted = false;

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
      if (!recStarted) {
        recStarted = true;
        void session.startLocalRecording({ windowSeconds: 60 }).catch(() => {
          recStarted = false;
        });
      }
    });

    session.on("trackEnded", (publicationId) => {
      const video = videos.get(publicationId);
      if (video) {
        video.srcObject = null;
        video.remove();
        videos.delete(publicationId);
      }
    });

    async function openReplay(lastSeconds) {
      if (replay) replay.close();
      replay = await session.openReplay({ lastSeconds });
      const el = replay.getElement();
      if (!el) return;
      el.muted = true;
      el.controls = true;
      replayHost.hidden = false;
      layout.classList.add("reviewing");
      replayHost.replaceChildren(el);
      replay.play();
    }

    function closeReplay() {
      replay?.close();
      replay = null;
      replayHost.replaceChildren();
      replayHost.hidden = true;
      layout.classList.remove("reviewing");
    }

    async function exportClip(lastSeconds) {
      const r = await session.openReplay({ lastSeconds });
      const el = r.getElement();
      const src = el?.src;
      if (!src) {
        r.close();
        return;
      }
      const a = document.createElement("a");
      a.href = src;
      const tatami = window.__VCC_TATAMI__ || "mat";
      a.download = `vcc-${tatami}-${Date.now()}-${lastSeconds}s.webm`;
      a.click();
      // Keep object URL briefly for download, then revoke via close
      setTimeout(() => r.close(), 1500);
    }

    content.querySelector("#rec-start").onclick = () => {
      recStarted = true;
      void session.startLocalRecording({ windowSeconds: 60 });
    };
    content.querySelector("#rec-stop").onclick = () => {
      void session.stopLocalRecording();
      recStarted = false;
    };
    content.querySelector("#replay6").onclick = () => void openReplay(6);
    content.querySelector("#replay10").onclick = () => void openReplay(10);
    content.querySelector("#slow").onclick = () => replay?.setRate(0.5);
    content.querySelector("#rate1").onclick = () => replay?.setRate(1);
    content.querySelector("#export10").onclick = () => void exportClip(10);
    content.querySelector("#close-replay").onclick = () => closeReplay();
  </script>
</body>
</html>
