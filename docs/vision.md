# Vízió

## Mi ez?

A **View–Controller Connector (VCC)** beágyazható webmodul, amely szabályozott kapcsolatot épít:

- **Controller** eszköz(ök) — tipikusan mobil / pontozó / kamera
- **View** eszköz(ök) — kijelzők (mérkőzés, videobíró, …)
- **Observer** — session aktiválás és kapcsolat-topológia megtekintése

Mindhárom szerep **ugyanazt a webalkalmazás-magot** használja, más szerepben. Együtt alkotnak egységet.

## Miért?

Olyan „kapcsolati szövet” kell, amit **bármely webes alkalmazásba** be lehet kötni (először demó, majd karate verseny oldal), anélkül hogy minden host újraírná a párosítást, WebRTC-t és a szereplogikát.

## Mi nem ez?

- Nem teljes verseny-menedzsment rendszer (az a host / karate oldal)
- Nem Sportdata / Kazo klón — azok zárt, helyszíni VAR + pontozó stackek
- Nem csak 1:1 scoreboard-remote (ilyenek léteznek: PlayOverlay, Cuetools, …)

A VCC **szállítási és szerepréteg**; a karate (vagy más) app a **domain**.

## Siker kritérium (hosszú táv)

1. Demóban 3 eszközzel végigjátszható a flow.
2. Ugyanaz a core PHP hostba ágyazható (karate).
3. Üzenetek csak regisztrált neveken mennek (fail-closed).
4. Média nem terheli a PHP webtárhelyet (P2P / később SFU).
