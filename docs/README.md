# View–Controller Connector (VCC) — dokumentáció

## Olvasási sorrend (tervezés lezárásához)

1. **[decisions.md](decisions.md)** — megállapodások + miértek  
2. **[api-surface.md](api-surface.md)** — zárolt publikus API (ez alapján épül)  
3. **[api-comparison.md](api-comparison.md)** — LiveKit / PeerJS tanulságok  
4. **[architecture.md](architecture.md)** + **[signaling-protocol.md](signaling-protocol.md)**  
5. **[demo-ux.md](demo-ux.md)** — demó vizuális UX/UI  
6. **[mvp.md](mvp.md)** — mit jelent a „kész modul”  
7. **[implementation-plan.md](implementation-plan.md)** — **S0–S12 sorrend + lépésenkénti tesztek**  

## Teljes lista

| Dokumentum | Tartalom |
|------------|----------|
| [decisions.md](decisions.md) | ADR megállapodások |
| [vision.md](vision.md) | Cél, pozicionálás |
| [api-comparison.md](api-comparison.md) | Modern API összevetés |
| [api-surface.md](api-surface.md) | **Zárolt** TypeScript szerződés |
| [implementation-plan.md](implementation-plan.md) | **Megvalósítási sorrend + tesztek** |
| [signaling-protocol.md](signaling-protocol.md) | WS wire protocol |
| [architecture.md](architecture.md) | Rétegek, P2P, adapterek |
| [roles.md](roles.md) | Observer / View / Controller |
| [use-cases.md](use-cases.md) | Flow + karate |
| [pairing.md](pairing.md) | Kód, QR, ConnectionMode |
| [message-protocol.md](message-protocol.md) | Üzenetek, routing, delivery |
| [embed-api.md](embed-api.md) | PHP / host bekötés |
| [demo-ux.md](demo-ux.md) | **Demó UX/UI terv** |
| [mvp.md](mvp.md) | Scope + acceptance |
| [market-notes.md](market-notes.md) | Piac / VAR jegyzet |
| [security.md](security.md) | **Security first**, titkok, runtime elvek |
| [open-questions.md](open-questions.md) | Nem blokkoló nyitottak |

## Állapot

- Tervezés + API: kész  
- Megvalósítási terv + tesztek: [`implementation-plan.md`](implementation-plan.md)  
- Kód: S0–S5 kész (`pnpm test:s3`, `test-s4.html`, `test-s5.html`); S6–S12 hátravan → modul még **nem** „kész”  
