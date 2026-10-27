# Architektúra

## Rétegek

```text
┌─────────────────────────────────────────────────────────┐
│  Host (apps/demo-php → később karate PHP)               │
│  oldalak, AppConfig JSON, slotok / saját UI             │
└──────────────────────────┬──────────────────────────────┘
                           │ betölti
┌──────────────────────────▼──────────────────────────────┐
│  packages/ui (opcionális)  — reference shellek          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  packages/core (TypeScript)                             │
│  szerepek, session, routing, WebRTC, message bus        │
│  SignalingAdapter · MediaTransport (P2P → később SFU)   │
└─────────────┬────────────────────────────▲──────────────┘
              │ WSS signaling              │ WebRTC P2P
              ▼                            │ media + DataChannel
┌─────────────────────────┐                │
│ packages/signaling      │                │
│ Node.js WebSocket       │                │
│ (local / később VPS)    │                │
└─────────────────────────┘                │
         peer ◄────────────────────────────┘ peer
```

## Adatutak

| Adat | Útvonal |
|------|---------|
| Session kód, peer join, SDP/ICE, topológia | **Signaling** (Node WSS; opcionális PhpPoll) |
| Pontozás, feature, JSON események | **WebRTC DataChannel** (P2P) |
| Élő kamera / hang | **WebRTC media tracks** (P2P) |
| Continuous felvétel (tervezett) | **Videobíró View gép** helyi buffer (IndexedDB/OPFS) |

A PHP/Node **nem** tárolja / továbbítja az élő streameket (kivéve TURN relay, ha NAT miatt kell).

## Csomagok (célkép)

| Csomag | Tech | Feladat |
|--------|------|---------|
| `packages/core` | TypeScript | Headless SDK |
| `packages/ui` | TypeScript | Reference UI |
| `packages/signaling` | Node + WS | Signaling szerver |
| `apps/demo-php` | Vanilla PHP | Teljes demó host + embed minta |
| Később | PhpPoll adapter | Shared host fallback |
| Később | SFU adapter | Multi-cam media plane |

## Miért ez a stack? (rövid)

Lásd: [decisions.md](decisions.md) D9–D11, D14, D16; [api-comparison.md](api-comparison.md).

- Böngésző API-k → TS core  
- Bidirectional signaling → WSS (2026 ajánlás)  
- Host minta → PHP demó + [demo-ux.md](demo-ux.md)  
- Kis N média → P2P; nagy N → SFU **ugyanazon** `Session.publishMedia` mögött  
- Publikus API → [api-surface.md](api-surface.md) (zárolt)  
- Wire → [signaling-protocol.md](signaling-protocol.md)
