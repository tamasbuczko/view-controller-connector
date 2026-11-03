<?php
declare(strict_types=1);

/** Demo VccConfig — no secrets. Signaling follows the page host when possible. */
$envSig = getenv('VCC_SIGNALING_URL');
if (is_string($envSig) && $envSig !== '') {
    $signalingUrl = $envSig;
} else {
    $httpHost = $_SERVER['HTTP_X_FORWARDED_HOST']
        ?? $_SERVER['HTTP_HOST']
        ?? '127.0.0.1:8080';
    // May be a comma-separated list if multiple proxies
    $httpHost = trim(explode(',', $httpHost, 2)[0]);
    $hostOnly = explode(':', $httpHost, 2)[0];
    if ($hostOnly === '' || $hostOnly === 'localhost') {
        $hostOnly = '127.0.0.1';
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '8443');
    if ($https) {
        // Same-origin WSS via LAN HTTPS gateway — phone/Safari needs one cert origin.
        $port = $_SERVER['HTTP_X_FORWARDED_PORT'] ?? '8443';
        $signalingUrl = 'wss://' . $hostOnly . ':' . $port;
    } else {
        $signalingUrl = 'ws://' . $hostOnly . ':8787';
    }
}

return [
    'signaling' => [
        'adapter' => 'websocket',
        'url' => $signalingUrl,
    ],
    'media' => [
        'transport' => 'p2p',
        'iceServers' => [
            ['urls' => 'stun:stun.l.google.com:19302'],
        ],
    ],
    'allowedModes' => ['1-1', '1-n', 'n-1', 'n-n'],
    'defaultMode' => 'n-n',
    'disconnectPolicy' => 'observer+view+self-leave',
    'groupTemplates' => [
        ['id' => 'cameras', 'label' => 'Cameras', 'maxMembers' => 4],
        ['id' => 'scoreboard', 'label' => 'Scoreboard', 'maxMembers' => 1],
    ],
    'catalog' => [
        ['name' => 'score.updated', 'type' => 'state', 'delivery' => 'reliable'],
        ['name' => 'match.competitors', 'type' => 'state', 'delivery' => 'reliable'],
        ['name' => 'camera.live', 'type' => 'event', 'delivery' => 'reliable'],
    ],
    // Multi-cam tatami: several phones may publish camera at once.
    // media-exclusive would allow only one — use last-write-wins for venue tests.
    'featureConflict' => [
        'camera.live' => 'last-write-wins',
        'score.updated' => 'last-write-wins',
    ],
];
