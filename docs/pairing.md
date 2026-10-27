# Párosítás és ConnectionMode

## Session felfedezés

- Observer aktivál → rövid **session kód** (+ opcionális share link)
- View / Controller: **kód** *vagy* **QR / deep link**
- **Nincs** publikus aktív-session lista

## QR / pair payload

Lásd `PairPayload` az [api-surface.md](api-surface.md)-ben. URI példa:

```text
vcc://pair?s=<sessionId>&target=<viewId|groupId>&t=<pairToken>&sig=<signalingUrl>&mode=<...>
```

(HTTPS deep link ugyanerre is lehet.)

## PairingTarget

- Egy **View**, vagy egy **ViewGroup** (`viewPeerId[]`)
- Egy QR a targetre → Controller linkel a target összes tag View-jához

## ConnectionMode

Config: `allowedModes` + `defaultMode`. Observer sessionenként választ.

| Mód | Jelentés | QR | Token |
|-----|----------|-----|-------|
| `1-1` | 1 View, 1 Controller | Csak View; párosítás után eltűnik | Egyszeri |
| `1-n` | 1 Controller → több View (group) | Observer + View-k; **első** Controller után eltűnik | Egyszeri |
| `n-1` | Több Controller → 1 View | View-n maradhat (hide/show); Observeren is | Újrahasználható |
| `n-n` | Több Controller × ViewGroup | Mint n-1 | Újrahasználható |

`n-n` = ViewGroup + multi-controller metszet — létező, érvényes preset.

## Ütközés (több Controller)

A `ConnectionMode` (+ opcionális `featureConflict[name]`) választ stratégiát — zárolt értékek:

- `last-write-wins`
- `active-lock`
- `media-exclusive`

(Host-specifikus logika: a catalog/handler rétegben, nem negyedik ConflictStrategy enum.)

## Session API

- `showPairingQr` / `hidePairingQr` + `pairingQr` event  
- 1-1 / 1-n: párosítás után automatikus elrejtés + token invalidate  
- Controller kód utáni párosítás: `pair(payload)` (lásd api-surface)
