# Szerepek

Összhang: [api-surface.md](api-surface.md), [decisions.md](decisions.md).

## Observer

- Session **létrehozás / aktiválás / deaktiválás**
- `ConnectionMode` választás az `allowedModes` közül
- ViewGroup összerakás a config sablonok / megengedett tagok szerint
- Topológia nézet (peers, groupok, élek)
- QR megjelenítés módszabály szerint (Observer / konnektor UI)
- Kick / disconnect: csak ha a `disconnectPolicy` engedi

**Nem:** új catalog `name` kitalálása a configon kívül; v1-ben nem fogyaszt nyers média tracket (csak topológia / meta).

## View

- Csatlakozás sessionhez View szerepben (`joinWithCode` / pair)
- Párosítási cél (önmaga vagy group tag)
- QR megjelenítés (módszabály)
- Üzenetek fogadása (`session.on("message")`) — host/UI jeleníti meg
- Média fogadás (`track` event)
- Demó/karate: **mérkőzés kijelző** és/vagy **videobíró**
- **Continuous record + replay** a videobíró View gépen (`startLocalRecording` / `openReplay`) — a v1 API és demó része

## Controller

- Csatlakozás session kóddal és/vagy QR (`joinWithPairToken` / `pair`)
- Üzenet küldés célzottan (`send`)
- Média küldés (`publishMedia` + `getUserMedia` — telefon vagy USB)
- Self-leave, ha a policy engedi

**Nincs külön „Camera” role** — a kamera Controllert a demó UI variant + catalog használat különbözteti meg.

## Kapcsolat a hosttal

A host adja a `VccConfig`-ot és a UI-t (`mount*` vagy saját). A szereplogika a `@vcc/core` Sessionben él.
