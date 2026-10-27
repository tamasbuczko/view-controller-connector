# Üzenetprotokoll

Teljes Session API: [api-surface.md](api-surface.md).

## Alapüzenet

```ts
{
  v: 1,
  id: string,
  type: "event" | "feature" | "asset" | "state" | "system",
  name: string,       // catalog topic — pl. "score.updated"
  ts: number,
  from: string,       // peerId (core/szerver — ne bízz kliens from-ban)
  to: string | string[],
  payload: unknown,
  delivery: "reliable" | "lossy",  // LiveKit-szerű
  replyTo?: string
}
```

- **reliable** — pont, állapot (default)  
- **lossy** — ahol a késés fontosabb, mint a garancia  

## Routing

1. Él csak párosítás után (Controller ↔ párosított View(k)).
2. `to` csak a küldő **párosított hatókörén** belül.
3. `"*"` = összes aktuálisan párosított View.
4. `groupId` = a group tagjai, akikhez van él.

## Host szerződés

- Catalog a configban; ismeretlen `name` → `NAME_NOT_IN_CATALOG`.  
- Handlerek a UI/host rétegben a `session.on("message")` alapján.

## Demó catalog

| name | delivery | Jelentés |
|------|----------|----------|
| `score.updated` | reliable | Állás |
| `match.competitors` | reliable | Ki jön |
| `camera.live` | reliable | Élő track meta / start-stop |
