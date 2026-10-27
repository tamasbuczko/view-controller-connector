# View–Controller Connector (VCC)

Beágyazható webmodul: **Observer / View / Controller** szerepekkel. Élő üzenetek + (következő iterációban) WebRTC média.

## Állapot

- Tervezés: [`docs/`](docs/)
- Security: [`docs/security.md`](docs/security.md) — **semmi secret a gitbe**
- Kód váz: `@vcc/core`, `@vcc/signaling`, `@vcc/ui`, `apps/demo-php`

## Local futtatás

Előfeltétel: Node 20+, pnpm, PHP 8+ a PATH-on.

```bash
pnpm install
pnpm --filter @vcc/core build
pnpm --filter @vcc/ui build
```

Két terminál:

```bash
# 1) Signaling (ws://127.0.0.1:8787)
pnpm dev:signaling

# 2) PHP demó (http://127.0.0.1:8080)
pnpm --filter @vcc/demo-php start
```

Böngésző:

1. http://127.0.0.1:8080/observer.php → **Aktiválás** → session kód  
2. http://127.0.0.1:8080/view-scoreboard.php → kód → csatlakozás  
3. http://127.0.0.1:8080/controller-score.php → ugyanaz a kód → AKA/AO pontok  

## Dokumentáció

→ [docs/README.md](docs/README.md)  
→ [docs/api-surface.md](docs/api-surface.md)  
→ [docs/security.md](docs/security.md)

## GitHub

https://github.com/tamasbuczko/view-controller-connector
