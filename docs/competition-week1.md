# Élő versenyteszt — technológia + demó host

kiai.hu összekötés: **később** ([competition-source.md](competition-source.md)). Most: fixture + VCC.

## Alkalmazás-flow

1. Nyisd: **`/comp/`** — tatami lista (tesztadat).
2. Válassz tatamit → **desk** (`/comp/tatami.php?id=t1`).
3. **Session indítás (n-n)** — Observer a deskben; kód megjelenik.
4. Nyisd a deep linkeket (új ablak / telefon):
   - Scoreboard TV
   - Video ref laptop
   - Score controller telefon
   - Camera controller telefonok (vagy QR a video-refen)
5. **Következő indítása** / Start egy küzdelemre — nevek a scoreboardon (host poll).
6. Pontozás telefonon → TV frissül; desk queue score sync.
7. Video-ref: REC + Replay 6/10s + 0.5×; **Export 10s** helyi letöltés.
8. **Következő meccs** a score telefonon → host `next` + 0–0.

## Szereposztás

| Eszköz | Szerep | URL |
|--------|--------|-----|
| Operátor laptop | Desk + Observer + Video-ref (2. ablak) | `/comp/tatami.php`, `/view-video.php?code=&tatami=` |
| TV / 2. kijelző | Scoreboard View | `/view-scoreboard.php?code=&tatami=` |
| Pontozó telefon | Score Controller | `/controller-score.php?code=&tatami=` |
| 2–4× kamera | Camera Controller | `/controller-camera.php?code=` vagy View QR |

**Observer ≠ megjelenítő.** A desk indítja a sessiont; a kép a video-ref View-n van.

## Hálózat

| Setup | OK? |
|-------|-----|
| Laptop **hotspot** — minden eszköz rajta | Igen (internet nem kell) |
| Terem **Wi‑Fi / LAN** ugyanaz a subnet | Igen |
| Csak **mobilnet** külön APN-nel | Nem (TURN nélkül) |
| Kevert Wi‑Fi + mobilnet | Nem |

Indítás a laptopon:

```bash
pnpm certs:lan          # egyszer
pnpm dev:lan-signaling
pnpm --filter @vcc/demo-php run start:lan
pnpm dev:lan-gateway
```

Telefon / TV: **https://\<LAN-IP\>:8443/comp/** — cert elfogadása.

`VCC_LAN_IP` állítsd a hotspot / LAN IP-re (scriptek default: `192.168.1.118`).

## Fixture reset

`/comp/` → **Fixture reset**, vagy `POST /comp/api/bout-action.php` `{ "action": "reset-seed" }`.

Runtime: `apps/demo-php/data/` (gitignore). Seed: `apps/demo-php/fixtures/competition.seed.json`.

## Mit nem csinálunk most

- kiai.hu HTTP
- TURN / SFU / cloud clip
- Teljes WKF óra/senshu motor
