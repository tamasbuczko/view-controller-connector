# Piac és technika — rövid jegyzet

## Profi videobíró / pontozás (karate és hasonlók)

- **Kazo Vision PARROT** + Ultra Score — multi-cam SDI, nonstop record, slow-mo, pontozás overlay
- **Sportdata SET Video Review** — multi/IP cam, event integráció, WKF-közeli stack
- **slomo.tv videoReferee** — általános sport VAR
- **WKF** szabály: tipikusan utolsó ~6 mp review, döntés ~30 mp alatt

Ezek **zárt, drága, helyszíni** rendszerek — nem beágyazható webmodulok.

## Telefon → kijelző remote (hasonló UX, más scope)

- PlayOverlay Phone remote, Cuetools Remote Link, ArenaCue Mobile
- Open source PoC-ok (pl. snooker WebRTC + QR)

Általában **1 termékbe zárt 1:1 remote**, nem általános N×M embed SDK.

## Böngészős continuous replay

- Profi: írás és olvasás szétválasztva (record nem áll le replay közben)
- Böngésző: chunkolt MediaRecorder + IndexedDB/OPFS; naiv WebM „gyűrűvágás” törékeny
- IP/RTSP ≠ getUserMedia — gateway kell

## Következtetés a VCC-re

- A **karate VAR + pontozó kijelző** ötlet nem új szolgáltatásként.
- A **beágyazható Observer/View/Controller konnektor** szabályozott API-val ritkább — ez a saját pozíció.
- Ne Sportdata-klón; **szállítási réteg + első vertical = karate**.
