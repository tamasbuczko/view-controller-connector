# Demó UX / UI terv (teljes termékfelület)

A demó **nem** „csak bekötés”. Modern, önálló vizuális termék, ami a teljes VCC felületet bemutatja. Brand a viewport hőse.

## Design irány

**Név a demóban:** **VCC** — alcím: *View · Controller · Connect*  
**Hangulat:** tatami / versenyhelyszín — higgadt, precíz, „élő adás” érzés; nem gamer neon, nem lila SaaS, nem újság-layout.

### Design tokenek

```css
:root {
  --vcc-ink: #12140f;
  --vcc-mat: #2f3d24;       /* tatami olíva */
  --vcc-mat-deep: #1a2414;
  --vcc-paper: #f3efe4;     /* meleg papír — NEM cream+terracotta klisé; accent más */
  --vcc-signal: #e8a317;    /* élő / figyelmeztetés — borostyán */
  --vcc-live: #c43c22;      /* recording / live pont */
  --vcc-line: color-mix(in oklab, var(--vcc-ink) 12%, transparent);
  --vcc-glow-soft: color-mix(in oklab, var(--vcc-mat) 35%, transparent);

  --font-display: "Syne", sans-serif;      /* expresszív, nem Inter */
  --font-ui: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace; /* session kód */

  --radius: 2px; /* szinte szögletes — sporteszköz, nem pill */
  --space: 8px;
}
```

**Háttér:** papír alapon finom átlós tatami-sáv textúra (CSS), sarkokban mat-deep gradiens légkör — nem flat egy szín.

**Tipográfia:** Syne 700 a brandhez (hero); UI IBM Plex Sans; kódok mono.

**Kerülendő:** lila gradient, Inter/Roboto, rounded-full pill cluster, multi-shadow card grid, emoji dekor, dark-mode default.

## Mozgás (3 szándékos)

1. **Session activate** — Observeren a státuszsáv „élő” vonala kihúzódik (transform scaleX).  
2. **Peer join** — topológia csomópont fade+slide 180ms.  
3. **Live camera** — piros „REC/LIVE” pont pulzus (opacity), `prefers-reduced-motion`: statikus.

## Információs architektúra

```text
/                    → belépő: brand hero + szerepválasztó (egy kompozíció)
/observer            → session operátor
/view/scoreboard     → mérkőzés kijelző
/view/video-ref      → videobíró
/controller/score    → pontozás
/controller/camera   → kamera forrás
```

Egy PHP app, route = szerep. Nincs dashboard-zsúfoltság a hero-n.

---

## Képernyők

### 1) Belépő (`/`) — hero

**Egy kompozíció:** edge-to-edge mat-deep → paper átmenet; középen **VCC** hatalmas Syne; egy sor: *Három szerep. Egy kapcsolat.*; CTA csoport: Observer / View / Controller (szöveges link-gombok, nem pill-chip sor).

Nincs: stat strip, feature card grid, floating badge.

### 2) Observer

**Layout:** bal 38% vezérlés, jobb 62% élő topológia (nem „card dashboard”).

- Fejléc: VCC wordmark kicsi + „Observer”  
- **Session kód** hatalmas mono (másolás egy tap)  
- Mode választó: 1-1 / 1-n / n-1 / n-n (szegmenses, szögletes) — csak allowed  
- Group szerkesztő: cameras / scoreboard taglista  
- QR panel (módszabály szerint)  
- Akciók: Aktivál / Deaktivál / Kick  
- Jobb: gráf vagy lista — View / Controller csomópontok, élek; élő státusz borostyánnal  

### 3) View — Scoreboard

**Teljes bleed „arena board”:**

- Fent: versenyző A | vs | versenyző B (Syne)  
- Középen: hatalmas állás számok  
- Lent: session státusz vékony sáv (kapcsolva / várakozik)  
- QR overlay **csak** ha mode engedi és nincs még pár — alsó harmad, nem floating sticker  

### 4) View — Video ref

**Egy sík: élő feed(ek) grid** (1 cam MVP vizuálisan is felkészítve 2×2-re).

- Sarok: LIVE / REC indikátor  
- Alsó kontrollsáv (egy sor): Replay last 6s · ◀︎ slow · rate · ▶︎ · Close replay  
- Replay módban az élő thumbnail kicsi marad (PiP nem „card”, hanem sáv)  
- Multi-cam: szinkron seek a replay session API-ra  

### 5) Controller — Score

**Mobil-first:**

- Brand sor minimal  
- Célválasztó: melyik View / group (ha több)  
- Nagy Aka / Ao gombok (piros / kék — karate), pont +1/+2/+3  
- Állás visszajelzés  
- Nincs felesleges navigáció  

### 6) Controller — Camera

**Mobil / USB cam laptop:**

- Teljes preview  
- Start/Stop publish  
- Címke: „cam-1”  
- Cél: video-ref group  

---

## Komponenselvek (reference UI)

| Komponens | Viselkedés |
|-----------|------------|
| `SessionCode` | mono, copy-on-tap, nincs card box ha a kontraszt elég |
| `QrStage` | mode lifecycle szerint mount/unmount |
| `TopologyMap` | SVG vagy CSS grid nodes — nem táblázat-halmaz |
| `ScoreBoard` | tipográfia-vezérelt, nem widget-kártyák |
| `VideoStage` | media element full-bleed |
| `ReplayBar` | egy kontrollsáv |
| `RoleDoor` | hero CTA a belépőn |

**Card szabály:** csak interaktív célpontnál (pl. cél View választó lista), ha a border nélkül is érthető — elhagyjuk.

---

## Reszponzivitás

- Observer: <900px → topológia a vezérlés alá stack  
- Scoreboard: landscape TV-optimalizált; portrait warning strip  
- Controllers: max-width 420px centered phone column  

## Accessibility

- Kontraszt: ink on paper / paper on mat  
- Fokususzgyűrű signal színnel  
- Reduced motion: pulzus off  
- QR mellett mindig kód / deep link szövegesen  

## Demó tartalom (dummy domain)

- Versenyzők: „AKA — Példa” / „AO — Minta”  
- Catalog nevek: `score.updated`, `match.competitors`, `camera.live`  
- 3 eszközös script a README-ben: Observer activate → scoreboard + videoref join → score + cam pair  

## Implementációs kötés

- Vizuál: `apps/demo-php` + `@vcc/ui` theme tokenek (`data-theme="vcc-demo"`)  
- Core headless marad — a szépség a UI/demo réteg  
