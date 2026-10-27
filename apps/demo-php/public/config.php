<?php
declare(strict_types=1);

/** Demo VccConfig — no secrets. Signaling is local ws. */
return [
    'signaling' => [
        'adapter' => 'websocket',
        'url' => getenv('VCC_SIGNALING_URL') ?: 'ws://127.0.0.1:8787',
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
    'featureConflict' => [
        'camera.live' => 'media-exclusive',
        'score.updated' => 'last-write-wins',
    ],
];
