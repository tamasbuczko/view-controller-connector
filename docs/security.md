# Biztonság — elsődleges szempont

A VCC-nél a **cyber security mindig megelőzi a kényelmet**. Érzékeny adat **sosem** kerül gitbe.

## Git / titkok

| Tilos a repóban | Helyette |
|-----------------|----------|
| `.env`, API kulcsok, tokenek | `.env.example` üres/placeholder mezőkkel |
| Private key, PEM, PFX | local `certs/` (gitignore) |
| TURN user/pass, session production secret | env / secret manager |
| Valós felvétel / személyes videó | local `recordings/` (gitignore) |
| npm token az `.npmrc`-ben | CI secret / user-level npmrc |

`.gitignore` ezt védi. Commit előtt: `git status` + ne legyen secret a diffben.

## Runtime elvek (v1)

1. **TLS:** produkcióban csak `WSS` / `HTTPS` (local demó: `ws`/`http` megengedett, dokumentáltan).  
2. **Titkok a belépéshez:** `sessionCode`, `pairToken` — sessionId önmagában nem elég.  
3. **Szerver osztja a `peerId`-t** — kliens `from` mező nem megbízható.  
4. **Origin allowlist** a WebSocket upgrade-nél (produkció).  
5. **Fail-closed catalog** — ismeretlen `name` → elutasítva.  
6. **Routing hatókör** — Controller csak párosított View-kra küldhet.  
7. **Rate limit / frame size** a signalingon (ICE burst kivétel dokumentálva).  
8. **Short-lived / módfüggő token** — 1-1 / 1-n: invalidate párosítás után.  
9. **disconnectPolicy** — kick csak config szerint.  
10. **Média:** P2P (nem a PHP hoston); TURN credential short-lived, ha van.  
11. **Replay buffer** helyi eszközön — ne töltsünk fel shared hostra review közben.  
12. **Nincs publikus session lista.**

## Fejlesztői checklist

- [x] Nincs secret a commitban (`.env` / `recordings/` gitignore)  
- [x] `.env.example` naprakész, értékek nélkül  
- [x] Produkció: `VCC_ENV=production` → `VCC_ALLOWED_ORIGINS` kötelező; non-local bind is  
- [x] Logokban `pairToken` / session code maszkolva (`summarizeMsg`)  
- [x] Signaling rate limit + max frame size  
- [ ] Függőségek: ismert CVE-k ellenőrzése release előtt (emberi lépés)  


Részletek: [signaling-protocol.md](signaling-protocol.md), [api-surface.md](api-surface.md), [decisions.md](decisions.md).
