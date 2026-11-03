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
  <title>VCC Score Controller</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <style>body{margin:0}</style>
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
    import { mountController } from "/assets/ui/index.js";
    const session = createSession(window.__VCC_CONFIG__);
    mountController(document.getElementById("app"), session, {
      mode: "score",
      autoJoinCode: window.__VCC_AUTO_CODE__ || undefined,
      tatamiId: window.__VCC_TATAMI__ || undefined,
      compact: Boolean(window.__VCC_AUTO_CODE__),
    });
  </script>
</body>
</html>
