# Élő versenyteszt — 1. hét (technológia)

kiai.hu összekötés: **később**. Most: helyszíni VCC demó stack.

## Szereposztás (fontos)

| Eszköz | VCC szerep | URL (LAN HTTPS) | Feladat |
|--------|------------|-----------------|---------|
| Laptop A — admin (opcionális) | **Observer** | `/observer.php` | Session aktiválás `n-n`, kód / QR |
| Laptop B — videobíró | **View** (video-ref) | `/view-video.php` | 2–4 élő kamera + REC + replay |
| Laptop C — pontozó kijelző | **View** (scoreboard) | `/view-scoreboard.php` | AKA/AO nagyban |
| Telefon(ok) — tatami kamera | **Controller** (camera) | `/controller-camera.php` | Élő stream → video-ref |
| Telefon — pontozó | **Controller** (score) | `/controller-score.php` | Pont + következő meccs |

**Observer ≠ megjelenítő.** Az Observer csak session/topológia. A kameraképet a **View (video-ref)** mutatja; a pontot a **View (scoreboard)**.

```text
Observer (indít)
    │
    ├─ View video-ref ←── Controller cam ×2–4  (WebRTC)
    │         └── LocalRecorder + Replay (élő megy tovább)
    │
    └─ View scoreboard ←── Controller score     (DataChannel)
```

## Indítás (helyszín Wi‑Fi)

```bash
pnpm certs:lan   # egyszer
pnpm dev:lan-signaling
pnpm --filter @vcc/demo-php run start:lan
pnpm dev:lan-gateway
```

Telefonok / laptopok: **https://\<LAN-IP\>:8443/...** (cert elfogadása).

## Párosítás forgatókönyv

1. Observer → mode **n-n** → Aktiválás → kód.
2. Video-ref + scoreboard → ugyanaz a kód → Csatlakozás.
3. Kamera telefonok: video-ref **QR** (vagy Pair URI) — így a stream a videobíróra megy.
4. Pontozó telefon: **session kód** → AKA/AO; **Következő meccs** nulláz.
5. Video-ref: **REC start** (ajánlott az első meccs előtt, ablak ~60s).
6. Review: **Replay last 6s / 10s** — élő csempék mennek tovább; Close replay.

## Mit nem csinálunk most

- kiai.hu mentés / következő meccs a weboldalon
- SFU / TURN (ha a Wi‑Fi P2P-t engedi; ha nem → TURN később)
- Per-kamera külön replay fájl (egy közös gyűrűbuffer)

## Gyors checklist a tatamin

- [ ] Mindhárom laptop ugyanazon a Wi‑Fin
- [ ] HTTPS 8443 nyitva, cert OK telefonon
- [ ] 2–4 kamera LIVE a video-ref gridben
- [ ] REC on → replay → élő nem áll meg
- [ ] Pont azonnal a scoreboardon
- [ ] Következő meccs → 0–0
