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
      <div class="grid" id="tiles"></div>`;

    const session = createSession(window.__VCC_CONFIG__);
    mountView(document.getElementById("app"), session, {
      title: "Video Ref View",
      contentEl: content,
    });

    const tiles = content.querySelector("#tiles");
    const videos = new Map();

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
  </script>
</body>
</html>
