# CompetitionSource — host adatforrás (kiai.hu később)

A verseny demó domain adatai **nem** a VCC core részei. A host egy `CompetitionSource` mögé bújik; most fixture, később HTTP.

## Interfész (szerződés)

```ts
interface Competitor {
  name: string;
  club?: string;
}

interface BoutScore {
  aka: number;
  ao: number;
  winner?: "aka" | "ao" | "draw";
}

interface Bout {
  id: string;
  categoryId: string;
  order: number;
  aka: Competitor;
  ao: Competitor;
  status: "waiting" | "live" | "done";
  score: BoutScore | null;
}

interface Tatami {
  id: string;
  name: string;
}

interface CompetitionSource {
  listTatamis(): Promise<Tatami[]>;
  listBouts(tatamiId: string): Promise<Bout[]>;
  pushResult(
    boutId: string,
    score: { aka: number; ao: number; winner: "aka" | "ao" | "draw" },
  ): Promise<void>;
}
```

## Implementációk

| Osztály / mód | Hol | Megjegyzés |
|---------------|-----|------------|
| **FixtureSource** | [`apps/demo-php/fixtures/competition.seed.json`](../apps/demo-php/fixtures/competition.seed.json) + [`public/comp/lib/store.php`](../apps/demo-php/public/comp/lib/store.php) | Seed → `data/competition.json` (gitignore) |
| **KiaiHttpSource** | *nincs még* | Ugyanaz az API shape; GET tatamik/bouts, POST eredmény |

## PHP API (jelenlegi)

- `GET /comp/api/tatamis.php`
- `GET /comp/api/tatami.php?id=`
- `POST /comp/api/session.php` — `{ tatamiId, sessionCode, sessionId }`
- `POST /comp/api/bout-action.php` — `start` \| `score` \| `complete` \| `next` \| `reset-seed`

## VCC üzenetek (transport)

- `score.updated` — élő pont
- `match.competitors` / `bout.state` — nevek (scoreboard + opcionális DC)
- Host poll a scoreboardon: ha az Observer nem küld DC-t, a `/comp/api/tatami.php` live bout a forrás
