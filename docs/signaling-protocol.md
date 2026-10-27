# Signaling wire protocol (v1)

Transport: **WebSocket** JSON üzenetek (`adapter: "websocket"`).  
Php-poll ugyanazokat a `type` mezőket POST/GET-eli mailboxban.

## Kliens → szerver

| type | Mikor | Mezők |
|------|--------|--------|
| `hello` | connect után | `{ protocol: 1, role?, clientInfo? }` |
| `session.create` | Observer | `{ mode, configHash? }` |
| `session.activate` | Observer | `{ sessionId }` |
| `session.deactivate` | Observer | `{ sessionId }` |
| `session.setMode` | Observer | `{ sessionId, mode }` |
| `group.define` | Observer | `{ sessionId, groupId, memberIds[] }` |
| `session.join` | View/Controller | `{ code }` vagy `{ pairToken }` + `role` |
| `signal.relay` | WebRTC | `{ toPeerId, payload }` (SDP/ICE opaque) |
| `peer.kick` | policy | `{ peerId, reason? }` |
| `peer.leave` | self | `{}` |
| `topology.subscribe` | Observer | `{ sessionId }` |

## Szerver → kliens

| type | Mezők |
|------|--------|
| `welcome` | `{ peerId, protocol: 1 }` |
| `session.created` | `{ sessionId, sessionCode, mode }` |
| `session.joined` | `{ sessionId, role, mode, peers[], groups[] }` |
| `peer.joined` / `peer.left` | `{ peerId, role? }` |
| `topology` | `TopologySnapshot` |
| `signal.relay` | `{ fromPeerId, payload }` |
| `pairing.token` | `{ target, pairToken, expiresAt, uri }` |
| `error` | `{ code, message }` |
| `pong` | (ha `ping`) |

## Szabályok

- `peerId`-t **mindig a szerver** osztja (ne bízzunk kliens `from` mezőben) — LiveKit/security best practice.
- Room/session ID nem titok; **pairToken** és **sessionCode** a belépési titok.
- WSS + Origin ellenőrzés produkcióban.
- Rate limit: signaling frame méret és gyakoriság (ICE burst engedett).
