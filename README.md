# View–Controller Connector (VCC)

Beágyazható webmodul: **Observer / View / Controller**. WebRTC DataChannel + P2P média, local record/replay a videobírón.

## Állapot

- Tervezés: [`docs/`](docs/)
- Security: [`docs/security.md`](docs/security.md) — **semmi secret a gitbe**
- Csomagok: `@vcc/core`, `@vcc/signaling`, `@vcc/ui`, `apps/demo-php`
- Megvalósítás: [`docs/implementation-plan.md`](docs/implementation-plan.md)

## 5 perces local indítás

Előfeltétel: Node 20+, pnpm, PHP 8+ a PATH-on.

```bash
pnpm install
pnpm build
```

**Két terminál:**

```bash
# 1) Signaling — ws://127.0.0.1:8787
pnpm dev:signaling

# 2) PHP demó — http://127.0.0.1:8080
pnpm dev:demo
```

### Score flow (3 böngésző / ablak)

1. [observer.php](http://127.0.0.1:8080/observer.php) → mode `n-n` → **Aktiválás** → kód másolása  
2. [view-scoreboard.php](http://127.0.0.1:8080/view-scoreboard.php) → kód → Csatlakozás  
3. [controller-score.php](http://127.0.0.1:8080/controller-score.php) → ugyanaz a kód → AKA / AO  

### Camera + video-ref (+ record)

4. [view-video.php](http://127.0.0.1:8080/view-video.php) → ugyanaz a kód  
5. [controller-camera.php](http://127.0.0.1:8080/controller-camera.php) → kód → **Kamera start**  
6. Video-ref: **REC start** → pár mp → **Replay last 6s** (élő marad)

### Pair URI (QR helyett)

Observer: View join után **QR (első View)** → URI másolása → Controller **Pair URI**.

## Tesztek

```bash
pnpm test          # unit + S3 signaling
# Böngésző (signaling + demó fut):
#   /test-s4.html … /test-s7.html
```

## Env (opcionális)

Másold `.env.example` → `.env` (gitignore). Produkcióban állítsd:

- `VCC_ALLOWED_ORIGINS` — kötelező nem-local Origin lista  
- `VCC_SIGNALING_PORT` / `VCC_SIGNALING_HOST`

**Ne** commitolj TURN jelszót / `.env`-et / `recordings/` tartalmat.

## Dokumentáció

→ [docs/README.md](docs/README.md)  
→ [docs/api-surface.md](docs/api-surface.md)  
→ [docs/security.md](docs/security.md)  
→ [docs/mvp.md](docs/mvp.md)

## GitHub

https://github.com/tamasbuczko/view-controller-connector
