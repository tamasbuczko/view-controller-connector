<?php
declare(strict_types=1);
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VCC — View · Controller · Connect</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>
    body { margin: 0; }
    .hero {
      min-height: 100vh;
      display: grid;
      place-content: center;
      gap: 1rem;
      padding: 2rem;
      text-align: center;
    }
    .hero h1 {
      font-family: var(--font-display);
      font-size: clamp(3rem, 12vw, 6rem);
      margin: 0;
      letter-spacing: -0.04em;
    }
    .hero p { margin: 0; opacity: 0.8; font-size: 1.15rem; }
    .cta { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; }
    .cta a {
      color: var(--vcc-paper);
      background: var(--vcc-ink);
      text-decoration: none;
      padding: 0.75rem 1.2rem;
      border-radius: 2px;
    }
    .cta a.secondary {
      background: transparent;
      color: var(--vcc-ink);
      border: 1px solid var(--vcc-ink);
    }
  </style>
</head>
<body data-theme="vcc-demo">
  <main class="hero">
    <h1 class="vcc-brand">VCC</h1>
    <p>View · Controller · Connect</p>
    <p>Három szerep. Egy kapcsolat.</p>
    <div class="cta">
      <a href="/observer.php">Observer</a>
      <a href="/view-scoreboard.php">View — Scoreboard</a>
      <a href="/view-video.php">View — Video</a>
      <a href="/controller-score.php" class="secondary">Controller — Score</a>
      <a href="/controller-camera.php" class="secondary">Controller — Camera</a>
    </div>
  </main>
</body>
</html>
