# Nyitott kérdések (nem API-törők)

A publikus szerződés zárt ([api-surface.md](api-surface.md)). Ezek részlet-döntések implementáció közben:

1. **Monorepo tool:** pnpm + Vite vs. más — nem befolyásolja a Session API-t.  
2. **QR lib:** melyik böngészős generátor / scanner (html5-qrcode stb.).  
3. **Replay tároló:** OPFS vs IndexedDB elsődleges — API ugyanaz.  
4. **TURN az első local demóban:** opcionális; LAN-on gyakran nem kell.  
5. **Topology viz:** SVG force vs. egyszerű lista az Observeren — UX tokenek adottak.  
6. **SFU szolgáltató** (ha eljön): LiveKit self-host vs. más — csak `MediaTransport` mögött.

Ha valami a Session publikus alakját érintené → major verzió + decisions frissítés.
