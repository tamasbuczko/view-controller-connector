# Megvalósítási sorrendterv + lépésenkénti tesztek

Ez a **kötelező kivitelezési terv**. Minden lépés (S0…S12) végén a **Teszt forgatókönyv** zöld nélkül a következő lépés **nem** indul.

Kapcsolódó: [api-surface.md](api-surface.md) · [mvp.md](mvp.md) · [security.md](security.md) · [demo-ux.md](demo-ux.md)

---

## Szabályok

1. **API-törés tilos** — csak a zárolt `api-surface` szerint.  
2. **Security first** — semmi secret a gitbe; produkciós út WSS/Origin.  
3. **Lépés = deliverable + exit kriterium + teszt**.  
4. A demó UX a [demo-ux.md](demo-ux.md) szerint készül; nem „ideiglenes csúnya UI”, kivéve ahol a lépés explicit stubot enged.  
5. Ideiglenes `data.relay` (signalingen át) **csak S4-ig** maradhat; S5 után a domain üzenetek DataChannelön mennek.

### Státusz jelmagyarázat

| Jelölés | Jelentés |
|---------|----------|
| DONE | Elkészült és a lépés tesztje zöld |
| IN PROGRESS | Folyamatban |
| TODO | Várakozik |

---

## Áttekintő

| # | Lépés | Státusz |
|---|--------|---------|
| S0 | Monorepo + tool + security baseline | DONE |
| S1 | Signaling WSS: session create/join/topology | DONE (alap) |
| S2 | Core Session: prepare, create, join, events, catalog | DONE (alap; media stub) |
| S3 | ConnectionMode + QR párosítás lifecycle | DONE |
| S4 | DataChannel üzenetek (relay kivezetése) | DONE |
| S5 | WebRTC P2P média publish/subscribe | DONE |
| S6 | Conflict + kick/disconnect policy | DONE |
| S7 | Local record + replay (video-ref) | DONE |
| S8 | `@vcc/ui` teljes shellek (demo-ux) | DONE |
| S9 | `demo-php` teljes route-ok + 3–5 eszköz script | DONE |
| S10 | Unit + integrációs automata tesztek | DONE |
| S11 | Security hardening (Origin, rate limit, log maszkolás) | DONE |
| S12 | Acceptance (mvp.md checklist) + release tag | DONE |

---

## S0 — Monorepo + security baseline

**Deliverable:** pnpm workspace, `.gitignore`, `.env.example`, `docs/security.md`, package vázak.

**Exit:** `pnpm install` sikeres; nincs secret a repóban.

### Teszt forgatókönyv S0

1. Friss clone / `pnpm install` hibamentes.  
2. `git status` — nincs `.env`, kulcs, `recordings/`.  
3. `.env.example` létezik, üres placeholder értékekkel.  
4. **PASS** ha 1–3 igaz.

---

## S1 — Signaling WSS (session create / join / topology)

**Deliverable:** `@vcc/signaling` — welcome, session.create, join (code), topology broadcast, peer left.

**Exit:** WS klienssel session létrehozható; második peer join után mindkettő kap topology-t.

### Teszt forgatókönyv S1

1. `pnpm dev:signaling` → log: `listening on ws://127.0.0.1:8787`.  
2. HTTP GET `/` → `200` + `VCC signaling OK`.  
3. WS1: `hello` → `welcome` + `peerId`.  
4. WS1: `session.create` mode `n-n` → `session.created` + `sessionCode` (6 char).  
5. WS2: `session.join` code + role `view` → `session.joined`.  
6. WS1 kap `peer.joined` és friss `topology` (2 peer).  
7. WS2 disconnect → WS1 kap `peer.left` + topology frissül.  
8. **PASS** ha 1–7 igaz.  
9. **FAIL** ha sessionCode ütközik / topology üres join után.

---

## S2 — Core Session (prepare, create, join, catalog)

**Deliverable:** `@vcc/core` `createSession`, events, fail-closed catalog, PHP demó pontozás (ideiglenes `data.relay` OK).

**Exit:** 3 böngésző: Observer aktivál → View + Controller kóddal join → pont megjelenik a scoreboardon.

### Teszt forgatókönyv S2

1. Build: `pnpm --filter @vcc/core build && pnpm --filter @vcc/ui build`.  
2. Signaling + `pnpm --filter @vcc/demo-php start`.  
3. Observer: Aktiválás → látszik a session kód.  
4. Scoreboard View: kód → Csatlakozás → „Kapcsolódva”.  
5. Score Controller: ugyanaz a kód → AKA +1 → scoreboardon `1 — 0`.  
6. AO +1 → `1 — 1`.  
7. `session.send({ name: "not.in.catalog" })` → `NAME_NOT_IN_CATALOG` error event.  
8. **PASS** ha 3–7 igaz.

**Jelenlegi megjegyzés:** S2 zöld a demó pontozásra; media metódusok még `NOT_IMPLEMENTED`.

---

## S3 — ConnectionMode + QR párosítás lifecycle

**Deliverable:** `pairing.mint`, `showPairingQr` / `pairingQr`, mode szerinti QR elrejtés (1-1 / 1-n / n-1 / n-n), `pair()` / `joinWithPairToken`, ViewGroup.

**Exit:** Mind a 4 mode viselkedése a [pairing.md](pairing.md) táblázat szerint demózható.

### Teszt forgatókönyv S3

**T1 — 1-1**  
1. Mode `1-1`, 1 View QR látszik.  
2. Controller scannel → link OK.  
3. QR eltűnik; második Controller ugyanazzal a tokennel → `TOKEN_CONSUMED` / elutasítva.

**T2 — 1-n**  
1. Group `cameras` 2 View taggal; group QR.  
2. Egy Controller join → mindkét View-hoz link.  
3. QR eltűnik mindenhol; második Controller nem tud ugyanarra a tokenre.

**T3 — n-1**  
1. View QR marad / hide-show működik.  
2. Két Controller ugyanarra a View-ra csatlakozik.  
3. Observeren 2 link látszik.

**T4 — n-n**  
1. Group + multi Controller; QR hide/show Observeren és View-n.  
2. Topológia helyes.

**PASS** ha T1–T4 mind zöld.

**Státusz:** DONE — `pnpm test:s3` (signaling WS forgatókönyvek T1–T4). Core: `pairing.ts` helpers + `pairing.closed` → QR hide. UI: Observer/View QR. Demó: pair URI a Controlleren.

---

## S4 — DataChannel üzenetek

**Deliverable:** WebRTC DataChannel `send` / `message` event; signaling `data.relay` **kivezetve** (vagy csak fallback flag mögött, default off).

**Exit:** Pontozás DataChannelön megy (DevTools: nincs `data.relay` a normál score flowban).

### Teszt forgatókönyv S4

1. Observer + View + Controller join (S2/S3 flow).  
2. ICE connected (lásd S5 előkészítés / párhuzamos peer connection data-only).  
3. Score +1 → View frissül.  
4. Signaling log / WS frame: score üzenet **nem** `data.relay`.  
5. Ismeretlen catalog név továbbra is fail-closed.  
6. `to: peerId` csak a cél View-t éri el (2 View esetén).  
7. **PASS** ha 3–6 igaz.

**Státusz:** DONE — `PeerMesh` + DataChannel; `signaling.dataRelayFallback` default off. Böngésző: `http://127.0.0.1:8080/test-s4.html` (broadcast, targeted `to`, catalog fail-closed).

---

## S5 — WebRTC P2P média

**Deliverable:** `publishMedia` / `unpublishMedia` / `track` / `trackEnded`; kamera Controller → video-ref View.

**Exit:** Élő kamera látszik a videobíró View-n; stop után trackEnded.

### Teszt forgatókönyv S5

1. Video-ref View join + Camera Controller join/pair.  
2. Camera: Start → View-n élő `<video>` (saját arc / USB cam).  
3. Stop → videó megáll, `trackEnded` event.  
4. Második kamera (ha mode engedi) → második tile a gridben.  
5. getUserMedia deny → `MEDIA_DENIED`.  
6. **PASS** ha 2–5 igaz (4 opcionális multi-cam).  
7. **Security:** media nem megy a PHP hoston keresztül (csak P2P / TURN).

**Státusz:** DONE — `publishMedia` / `unpublishMedia` / `track` / `trackEnded` a PeerMesh-en. Demó: `/view-video.php`, `/controller-camera.php`. Automata: `test-s5.html` (canvas.captureStream, no cam permission).

---

## S6 — Conflict + disconnect policy

**Deliverable:** `featureConflict` stratégiák; `kick` / `leave` policy szerint; `conflict` event.

**Exit:** Dokumentált policy viselkedés demózható.

### Teszt forgatókönyv S6

1. `disconnectPolicy: observer-only` — View kick kísérlet → `POLICY_DENIED`.  
2. `observer+view+self-leave` — Controller `leave` OK; Observer kick OK.  
3. Két Controller `score.updated` last-write-wins — utolsó állás marad.  
4. `camera.live` media-exclusive — második publish conflict event / elutasítás.  
5. **PASS** ha 1–4 igaz.

**Státusz:** DONE — `canKick` / `denyUnlessKickAllowed`; `ConflictBoard` + signaling `conflict.claim|release`; LWW / active-lock / media-exclusive. Automata: `test-s6.html`.

---

## S7 — Local record + replay

**Deliverable:** `startLocalRecording` / `stopLocalRecording` / `openReplay` a video-ref gépen; élő stream nem áll le replay közben.

**Exit:** WKF-szerű „last 6s” visszanézés működik.

### Teszt forgatókönyv S7

1. Élő cam + recording active (REC indikátor).  
2. ~10 mp mozgás a kamerában.  
3. Replay last 6s → a mozgás látszik; élő PiP/sáv tovább megy.  
4. Rate 0.5× / seek működik.  
5. Close replay → vissza élő full view.  
6. Recording közben tab crash szimuláció: hiba kezelhető (`RECORDING_FAILED` vagy graceful stop).  
7. **PASS** ha 1–5 igaz.  
8. **Security:** felvétel nem kerül gitbe / nem upload shared hostra.

**Státusz:** DONE — `LocalRecorder` (MediaRecorder chunk ring) + `openReplay`; élő stream független. Demó: `/view-video.php` REC/replay sáv. Automata: `test-s7.html`.

---

## S8 — `@vcc/ui` teljes shellek

**Deliverable:** mountObserver / mountView (scoreboard + video-ref) / mountController (score + camera) a [demo-ux.md](demo-ux.md) tokenekkel és motionnal.

**Exit:** Design review checklist (brand hero, nincs tilott AI-klisé layout).

### Teszt forgatókönyv S8

1. Belépő `/` — egy kompozíció, VCC brand hero.  
2. Observer — kód + topology, tatami tokenek.  
3. Scoreboard — tipográfia-vezérelt állás, QR csak mode szerint.  
4. Video-ref — full-bleed + replay bar.  
5. Controllers — mobil oszlop, Aka/Ao.  
6. `prefers-reduced-motion`: nincs pulzus.  
7. **PASS** ha 1–6 vizuálisan és funkcionálisan OK.

---

## S9 — demo-php teljes + több eszköz script

**Deliverable:** Összes route; README „5 perces” forgatókönyv; group demo.

**Exit:** Idegen gép/olvasó a README alapján végigviszi.

### Teszt forgatókönyv S9

1. Hideg indítás README szerint (2 terminál).  
2. 3 böngésző: score flow (S2).  
3. 4–5 kontextus: 2 cam + video-ref + scoreboard + score controller (ahol S5+ kész).  
4. README-ben nincs secret / valós TURN jelszó.  
5. **PASS** ha 1–4 igaz.

---

## S10 — Automata tesztek

**Deliverable:** Unit (catalog, mode, token lifecycle); signaling integráció (ws); CI script opcionális.

**Exit:** `pnpm test` zöld.

### Teszt forgatókönyv S10

1. `pnpm test` — mind zöld.  
2. Szándékos regresszió (catalog bypass) → teszt piros.  
3. **PASS** ha 1–2 igaz.

---

## S11 — Security hardening

**Deliverable:** `VCC_ALLOWED_ORIGINS` kötelező nem-local; rate limit; logokban token maszkolás; short-lived token enforce.

**Exit:** [security.md](security.md) checklist kipipálva.

### Teszt forgatókönyv S11

1. Origin deny: idegen Origin → WS close 1008.  
2. Pair token a logban nem teljes érték (maszkolt).  
3. Flood signaling → rate limit / kapcsolat zárás.  
4. `.env` nincs a git history új commitjaiban.  
5. **PASS** ha 1–4 igaz.

---

## S12 — Acceptance + release

**Deliverable:** [mvp.md](mvp.md) acceptance mind zöld; git tag `v0.1.0` (vagy v1.0.0-rc).

### Teszt forgatókönyv S12 (összefoglaló acceptance)

1. api-surface metódusok: implementálva vagy dokumentált `NOT_IMPLEMENTED` csak SFU/php-poll-ra.  
2. Demó UX mindhárom szerep + scoreboard + video-ref + cam.  
3. Mode 1-1, 1-n, n-1, n-n demózható.  
4. Multi controller / multi view OK.  
5. Replay last N sec élő mellett.  
6. PHP embed minta másolható.  
7. Security checklist OK.  
8. **PASS = modul „kész”** a projekt definíciója szerint.

---

## Jelenlegi helyzet (rövid)

- **S0–S12:** DONE — lásd [acceptance-v0.1.md](acceptance-v0.1.md).  
- A kérdésre („kész a modul?”): **igen** a v0.1 magra (SFU/PhpPoll/karate host külön).

## Következő konkrét lépés

Release tag `v0.1.0`; opcionális: SFU slot, PhpPoll, karate embed.
