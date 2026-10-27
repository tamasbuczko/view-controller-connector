# Use-case-ek

## Általános párosítási forgatókönyv

1. Observer aktiválja a sessiont (és választ módot a kereten belül).
2. View(ek) csatlakoznak; QR megjelenik a ConnectionMode szerint.
3. Controller(ek) session kóddal és/vagy QR-rel csatlakoznak.
4. Observeren látszik a topológia.
5. Controllerek üzenetet / médiát küldenek; View-k a regisztrált szabályok szerint jelenítik meg.

## Karate (első vertical — bekötés 2. fázis)

| Szerep | Hol | Feladat |
|--------|-----|---------|
| Observer | Asztali admin | Session, topológia, kód/QR |
| View — videobíró | Monitor / laptop | Élő kamera feed(ek) + continuous record/replay (modul v1) |
| View — mérkőzés | Tatami TV | Ki jön, állás |
| Controller — pontozás | Bíró eszköz | Pontozás → mérkőzés View |
| Controller — kamera | Telefon vagy USB cam | Élő stream → videobíró |

Egy meccs = egy session; kamera-group és scoreboard külön PairingTarget / group lehet.

## Demó (1. fázis) — mini domain

Ugyanaz a szerepstruktúra, de:

- Mini score state (nem karate DB)
- Egy élő kamera
- PHP demó oldalak + Node signaling lokálisan
