# Acceptance — VCC v0.1.0

Dátum: 2026-10-28  
Alap: [mvp.md](mvp.md) + [implementation-plan.md](implementation-plan.md) S12.

| # | Kritérium | Eredmény |
|---|-----------|----------|
| 1 | Publikus Session API: implementálva; SFU / php-poll → `NOT_IMPLEMENTED` | PASS |
| 2 | Demó: Observer, scoreboard, video-ref, score + camera controller | PASS |
| 3 | Mode 1-1 / 1-n / n-1 / n-n (`pnpm test:s3`) | PASS |
| 4 | Multi controller / multi view (S3 T3–T4, S4 targeted send) | PASS |
| 5 | Replay last N sec élő mellett (`test-s7.html`) | PASS |
| 6 | PHP embed minta (`apps/demo-php`, README 5 perc) | PASS |
| 7 | Security: Origin enforce non-local/prod, rate limit, token maszkolás, `.env` gitignore | PASS |
| 8 | `pnpm test` zöld | PASS |

**Release:** git tag `v0.1.0` ezen a commiton.

**Nem része a v0.1 magnak (szándékos):** SFU motor, PhpPoll adapter, karate host DB, TURN provisioning.
