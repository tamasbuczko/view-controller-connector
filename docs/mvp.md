# Modul scope és szállítási sorrend

## Alapelv (frissítve)

A **teljes VCC modul API-ja előre zárolt** ([api-surface.md](api-surface.md)).  
Cél: **egyszer megtervezett felület**, amit implementálunk — ne kelljen később törni a hostokat.

| Réteg | „Kész” mit jelent |
|-------|-------------------|
| **`@vcc/core` v1** | Teljes publikus Session API: szerepek, N×M, group, mode, QR lifecycle, send/media, recording/replay API, eventek, hibák |
| **`@vcc/signaling` v1** | WSS protocol ([signaling-protocol.md](signaling-protocol.md)) |
| **`@vcc/ui` + `demo-php` v1** | Teljes szerep UX ([demo-ux.md](demo-ux.md)) — scoreboard, video-ref, score, camera, observer |
| **Adapter slotok** | `php-poll`, `media: sfu` — **interfész a v1-ben**, implementáció opcionális / következő csomag |
| **Karate host** | Külön projekt/fázis — **ugyanarra** a zárolt API-ra ül |

Tehát: a modul **nem** „MVP-csonk API”; a demó **nem** bekötés-vázlat. Amit későbbre hagyunk, az **infra adapter** és **külső host**, nem a mag szerződés.

## Implementációs build order (belső, API-törés nélkül)

1. Config + Session skeleton + events + error codes  
2. Signaling WSS + session code/join/topology  
3. Pairing QR / mode lifecycle  
4. DataChannel send/receive + catalog fail-closed  
5. WebRTC P2P media publish/subscribe  
6. Recording/replay local buffer (video-ref)  
7. Conflict strategies + kick/disconnect policy  
8. `@vcc/ui` shellek a [demo-ux](demo-ux.md) szerint  
9. `apps/demo-php` teljes route-ok + README 3-eszköz script  

Párhuzamosan teszt: unit core; manuális 3–5 böngésző.

## Expliciten NEM a core v1 része (de API-n van hely)

| Elem | Megjegyzés |
|------|------------|
| SFU motor | `media.transport: "sfu"` config + adapter interfész; implementáció külön |
| PhpPoll | `adapter: "php-poll"`; implementáció shared host igényre |
| IP/RTSP ingest | host/gateway; Controller továbbra is `getUserMedia` / custom track |
| Karate DB | host domain |
| User login | későbbi auth réteg a pairToken elé |

## Acceptance — modul „kész”

- [ ] api-surface minden metódusa létezik (SFU/poll: clear `NOT_IMPLEMENTED` vagy working stub dokumentálva)  
- [ ] Demó UX mindhárom szerepre + scoreboard + video-ref + cam  
- [ ] 1-1, 1-n, n-1, n-n módok demózhatók  
- [ ] Multi Controllers / multi Views a demóban kipróbálható  
- [ ] Replay last N sec videobírón, élő stream mellett  
- [ ] PHP embed minta README szerint másolható karatehoz  
