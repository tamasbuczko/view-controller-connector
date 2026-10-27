# Megállapodások és miértek

Rögzített döntések ADR stílusban. Ha egy döntés változik, itt frissítjük a „Státusz” és „Miért” mezőket.

---

## D1 — Három szerep, egy webalkalmazás-modul

| | |
|--|--|
| **Döntés** | Observer, View, Controller — ugyanaz a VCC mag, különböző szerepben; együtt alkotnak egységet. |
| **Miért** | Mindhárom eszköz ugyanazt a webappot futtatja; a különbség a szerep és a bekötött UI/feature, nem külön termék. |
| **Státusz** | Rögzítve |

---

## D2 — Beépíthető modul + demó + későbbi host

| | |
|--|--|
| **Döntés** | A VCC önálló, kipróbálható modul. Mellé `apps/demo-php` referencia-bekötés. Első valódi host később: karate verseny PHP oldal. |
| **Miért** | Minden funkció önmagában is demózható; a PHP demó pontos mintát ad a karate embedhez anélkül, hogy a mag a karatehoz kötődne. |
| **Státusz** | Rögzítve |

---

## D3 — App config vs Observer (1B)

| | |
|--|--|
| **Döntés** | **App config** = szabálykeret (`allowedModes`, `catalog`, `groupTemplates`, `featureConflict`, `disconnectPolicy`). **Observer** = operátor a kereten belül (session activate, mode választás, group a sablonokból, topológia, QR). |
| **Miért** | A host app határozza meg, mit szabad; az Observer nem találhat ki új message `name`-et futásidőben. Így a modul biztonságosan ágyazható be. |
| **Státusz** | Rögzítve |

---

## D4 — UI: 2C hybrid

| | |
|--|--|
| **Döntés** | Headless core + opcionális `@vcc/ui` (`mountObserver` / `mountView` / `mountController`). Host: mountolja, saját oldalt ír, vagy csak a Session API-t hívja. |
| **Miért** | Observer gyakran widget; View/Controller gyakran a host teljes oldala. Kötelező slot minden szerepre túl szűk; csak API túl sok host-munka a demóhoz. |
| **Státusz** | Rögzítve |

---

## D5 — Topológia: N×M, ViewGroup, vegyes routing

| | |
|--|--|
| **Döntés** | Több View és több Controller egy sessionben. ViewGroup: több View egy párosítási cél. Egy QR → link a group tagjaihoz. Küldéskor célválasztás (egy / részhalmaz / összes párosított). |
| **Miért** | Karate: több kamera + külön mérkőzés-kijelző + pontozó; 1:1 túl szűk. A group egy QR-rel egyszerűsíti a több View-hoz kapcsolást. |
| **Státusz** | Rögzítve |

---

## D6 — ConnectionMode vezérli a QR-t és az ütközést (1D)

| | |
|--|--|
| **Döntés** | Módok: `1-1`, `1-n`, `n-1`, `n-n`. Config: `allowedModes` + default; Observer választ. Ütközésstratégia módból (+ per-feature override). |
| **QR UI** | **1-1:** QR csak View-n, párosítás után eltűnik. **1-n:** konnektor+View-k, első Controller után eltűnik. **n-1 / n-n:** QR maradhat (hide/show), konnektoron is. |
| **Miért** | Egy merev QR-politika nem fedi a use-case-eket; a mód explicit termék-szabály. Az ütközés (több Controller) feature-függő — a host config dönt. |
| **Státusz** | Rögzítve |

---

## D7 — Session felfedezés: kód vagy QR (nincs lista)

| | |
|--|--|
| **Döntés** | Rövid session kód **vagy** QR/deep link. Nincs publikus „összes aktív session” lista. |
| **Miért** | Kevesebb véletlen / unwanted csatlakozás; versenyhelyszínen a kód és a QR elég. |
| **Státusz** | Rögzítve |

---

## D8 — Disconnect politika app configból

| | |
|--|--|
| **Döntés** | `disconnectPolicy` a configban. Demó default: `observer+view+self-leave`. |
| **Miért** | Különböző hostok más szigort akarnak; ne legyen beégetett A/B/C a core-ba. |
| **Státusz** | Rögzítve |

---

## D9 — Tech stack: TS core, Node WSS, PHP host

| | |
|--|--|
| **Döntés** | Böngésző-mag: **TypeScript**. Signaling (local/demó/éles WS): **Node.js WebSocket (WSS)**. Demó host: **vanilla PHP** lokálisan. Karate később ugyanígy embedel. |
| **Miért** | WebRTC / getUserMedia / DataChannel / felvétel = böngésző API — PHP-ben nincs értelme a magnak. WS a 2026-os ajánlott signaling (MDN, web.dev); PHP poll csak shared-host fallback. A PHP demó tanítja a karate bekötést. |
| **Státusz** | Rögzítve (2026 netes validációval) |

---

## D10 — Médiaút: WebRTC P2P default; SFU adapter slot

| | |
|--|--|
| **Döntés** | Élő kép/hang és DataChannel **peer-to-peer** a böngészők között (v1 implementáció). A szerver csak signaling (+ opcionális TURN). `media.transport: "sfu"` **slot** a configban; SFU motor külön csomag, ugyanaz a Session API. |
| **Miért** | A webtárhely nem bírná a streameket. P2P elég demó/LAN/kis N-re. Nagyobb multi-cam terhelésnél SFU — API-törés nélkül. |
| **Státusz** | Rögzítve |

**Fontos megértés:** P2P ≠ „hálózat nélkül”. A forgalom Wi‑Fi / interneten megy, csak **nem** a PHP/Node app-szerveren „föl-le” streamként, hanem a két böngésző között (helyi routeren vagy interneten; TURN csak ha a NAT blokkol).

---

## D11 — Infra: local most; élesben webtárhely + VPS signaling

| | |
|--|--|
| **Döntés** | Fejlesztés: minden lokál (Node signaling + `php -S` demó). Éles Node WS: **kis VPS** (vagy PaaS). Karate PHP **maradhat** webtárhelyen. Ha nincs VPS: PhpPoll adapter. |
| **Miért** | Shared host nem futtat tartós WS processt. A teljes site-ot nem kell VPS-re költöztetni — csak a signalinget. |
| **Státusz** | Rögzítve |

---

## D12 — Karate use-case (első vertical, nem az első kód)

| | |
|--|--|
| **Döntés** | Observer = asztali admin. View = videobíró + mérkőzés kijelző. Controller = pontozás + kamera-források. |
| **Kamera** | Telefon **vagy** dedikált USB/`getUserMedia` eszköz. IP/RTSP = későbbi fázis. |
| **Felvétel** | Continuous record + visszanézés a **videobíró View gépen** (források csak streamelnek). |
| **Miért** | WKF/profi VAR mintája: nonstop record, független replay. Shared hostra streamelni review közben rossz. USB/`getUserMedia` elég a v1 kamerához. |
| **Státusz** | Rögzítve (karate bekötés = külön host fázis) |

---

## D13 — Modul v1 scope (felülírja a régi „MVP 1B csonk” gondolatot)

| | |
|--|--|
| **Döntés** | A **core + demó v1** a zárolt API szerint készül: N×M, mode-ok, group, pontozás, multi-cam képes media API, local record/replay a videobírón. **Nem** a mag része: karate DB, SFU motor, PhpPoll implementáció, IP/RTSP. Lásd [mvp.md](mvp.md). |
| **Miért** | D16: ne törjük később az API-t. A korábbi „1B szelet” csak build-sorrend tipp volt; a szerződés teljes. |
| **Státusz** | Rögzítve (D16-tal összhangban) |

---

## D14 — Mit nem választunk most (tudatosan)

| Elutasítva | Miért |
|------------|--------|
| Teljes modul PHP-ben | Nincs natív WebRTC/media a szerver-PHP-ben; rossz hely a magnak |
| PHP poll mint default signaling | Pazarló, lassabb; WS a modern default |
| WebTransport / MoQ az első stack | 2026-ban nem váltja le a WebRTC P2P-t |
| LiveKit/SFU az első naptól | Túl nagy infra; `sfu` adapter slot elég a v1-hez |
| Publikus session lista | Biztonság / véletlen join |
| IP kamera a v1 demóban | RTSP gateway kell; USB/telefon elég |

---

## D15 — Auth v1

| | |
|--|--|
| **Döntés** | Nincs user-fiók a v1-ben; session secret + módfüggő `pairToken` / session kód. |
| **Miért** | Gyors demó és versenyhelyszín; auth réteg később a token elé tehető breaking nélkül. |
| **Státusz** | Rögzítve |

---

## D16 — Teljes modul API előre zárolva (ne törjük később)

| | |
|--|--|
| **Döntés** | A publikus Session API, eventek, hibák, signaling wire, replay API **előre specifikált** ([api-surface.md](api-surface.md)). SFU/PhpPoll: adapter **slot** a v1-ben. Karate = külön host. |
| **Miért** | Modern SDK-k (LiveKit Room/events/publishData) mutatják: stabil szerződés kell. A „majd implementációkor kitaláljuk” embed API későbbi host-törést okoz. |
| **Státusz** | Rögzítve |

---

## D17 — Demó = teljes modern UX, nem csak bekötés

| | |
|--|--|
| **Döntés** | A `demo-php` + `@vcc/ui` követi a [demo-ux.md](demo-ux.md) vizuális rendszert (Syne / tatami tokenek, szerep képernyők, motion). |
| **Miért** | A modul kipróbálhatósága UX nélkül hamis; a referencia UI a hostok mintája is. |
| **Státusz** | Rögzítve |
