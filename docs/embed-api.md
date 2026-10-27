# Embed útmutató (hostoknak)

A **teljes típusos szerződés:** [api-surface.md](api-surface.md).  
Ez a lap a PHP / bármely host **bekötési mintája**.

## Minimális PHP minta

```php
<?php
$config = [
  'signaling' => ['adapter' => 'websocket', 'url' => 'wss://127.0.0.1:8787'],
  'media' => ['transport' => 'p2p'],
  'allowedModes' => ['1-1', '1-n', 'n-1', 'n-n'],
  'defaultMode' => 'n-n',
  'disconnectPolicy' => 'observer+view+self-leave',
  'groupTemplates' => [
    ['id' => 'cameras', 'maxMembers' => 4],
    ['id' => 'scoreboard', 'maxMembers' => 1],
  ],
  'catalog' => [
    ['name' => 'score.updated', 'type' => 'state', 'delivery' => 'reliable'],
    ['name' => 'match.competitors', 'type' => 'state'],
    ['name' => 'camera.live', 'type' => 'event'],
  ],
  'featureConflict' => [
    'camera.live' => 'media-exclusive',
    'score.updated' => 'last-write-wins',
  ],
];
?>
<script>window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE) ?>;</script>
<script type="module" src="/assets/vcc-core.js"></script>
<script type="module" src="/assets/vcc-ui.js"></script>
<script type="module">
  import { createSession } from '/assets/vcc-core.js';
  import { mountObserver } from '/assets/vcc-ui.js';
  const session = createSession(window.__VCC_CONFIG__);
  await session.prepare();
  mountObserver(document.querySelector('#app'), session);
</script>
```

## Szerep oldalak

| Route (demó) | Mount |
|--------------|--------|
| `/observer` | `mountObserver` |
| `/view/scoreboard` | `mountView` + `variant: "scoreboard"` |
| `/view/video-ref` | `mountView` + `variant: "video-ref"` |
| `/controller/score` | `mountController` + `variant: "score"` |
| `/controller/camera` | `mountController` + `variant: "camera"` |

Saját UI: ne mountolj; hallgasd a `session.on(...)` eseményeket és hívd a Session metódusokat.

## Fail-closed

Ha a host `send({ name: "foo" })`-t hív, és `foo` nincs a `catalog`-ban → `NAME_NOT_IN_CATALOG`.  
Új domain üzenet = catalog bővítés a host configban, **nem** core fork.
