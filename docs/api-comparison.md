# Modern API összevetés → VCC tanulságok

Források: [LiveKit JS SDK](https://docs.livekit.io/intro/basics/connect/), [PeerJS](https://peerjs.com/docs/), [simple-peer](https://github.com/feross/simple-peer), MDN/web.dev WebRTC.

## Mit csinálnak jól a piaci API-k?

| Minta | LiveKit | PeerJS / simple-peer | VCC átvétel |
|-------|---------|----------------------|-------------|
| Session / Room mint központi objektum | `Room.connect(url, token)` | `new Peer(id)` | **`Session`** + szerep join |
| Event-driven | `room.on(RoomEvent.*)` | `peer.on('connect'\|'data'\|'stream')` | **Typed events** a Sessionen |
| Data: célzott kézbesítés | `destinationIdentities`, `topic` | 1:1 `conn.send` | **`to` + `name` (topic)** |
| Data: reliable vs lossy | `reliable: true/false` | `reliable` opció | **`delivery: "reliable" \| "lossy"`** |
| Media publish/subscribe | `publishTrack` / `TrackSubscribed` | `addStream` / `stream` event | **`publishMedia` / `on("track")`** |
| Tokenös belépés | JWT room token | peer id string | **sessionCode + pairToken** (szerep+target) |
| Felkészülés | `prepareConnection` | — | **`session.prepare()`** (ICE/signaling warm) |

## Hol különbözik a VCC (szándékosan)?

| LiveKit / PeerJS | VCC |
|------------------|-----|
| Általános room / nyers peer | **Observer / View / Controller** első osztályú szerepek |
| Media-first konferencia | **Kapcsolati szövet** üzenet+média, host domain handlerekkel |
| SFU alap (LiveKit) | **P2P default**, `MediaTransport` → SFU később **ugyanazzal** az API-val |
| Nincs ConnectionMode / QR lifecycle | **ConnectionMode**, ViewGroup, QR politika beépítve |
| Nincs App config keret | **fail-closed** regisztrált `name`-ek, Observer a kereten belül |

## Rétegek (hogy ne keverjük)

```text
Host domain (pont, meccs)     ← karate / demo-php
    ↑
VCC Session + Roles + Messages ← MI ÉPÍTJÜK (stabil API)
    ↑
WebRTC / Signaling adapters    ← P2P+WSS most; SFU/poll cserélhető
```

**Következtetés:** LiveKit-szerű *Room + events + publishData(topic, destinations, reliable)* mintát követünk a transport rétegben; a **szerep / pairing / config** réteg a VCC hozzáadott értéke. PeerJS szintű nyers peer API-t **nem** exportálunk hostoknak — túl alacsony, később törik a termékmodell.

## Hiányok a korábbi VCC doksikban (pótlandó → api-surface)

1. Nincs teljes typed event lista  
2. Nincs `delivery` (reliable/lossy)  
3. Nincs `prepare()` / disconnect okok / error kódok  
4. Nincs signaling wire protocol  
5. Nincs media + replay API a „teljes modul” szintjén  
6. Embed API „majd implementációkor kristályosodik” → **javítva**: [api-surface.md](api-surface.md) zárolva  

## Audit (ellenőrzés)

Lásd a döntések összhangját: D13 frissítve D16/`mvp.md` szerint; elavult „MVP csonk” szövegek kiszedve.
