# Piac és technika — rövid jegyzet

## Elevator pitch

Mindenhol kell, hogy telefonok, kijelzők és kamerák együtt dolgozzanak. Ma vagy drága zárt hardvert veszel, vagy egy appba zárt remotot, vagy hónapokig írod újra a WebRTC-t.

A **VCC** beágyazható szövet: **Observer** indít, **View** megjelenít, **Controller** vezérel — szabályozott üzenetekkel és élő médiával, bármely webes termékbe. Nem meeting-szoba, nem poll-app, nem egy sport-SKU.

*Embeddable Observer–View–Controller fabric — connect and control any devices in your app, without rebuilding pairing and WebRTC.*

## Konkurencia (mire lőnek)

| Sáv | Példa | Lövés |
|-----|-------|--------|
| Video CPaaS | LiveKit, Daily, Agora | Meeting / SFU / AI room |
| Pub/Sub | Ably, Pusher | Chat, presence, telemetry |
| Phone→screen SDK | **Interaxo** (legközelebb) | Telefon ↔ kijelző üzenet, hosted credit |
| Zárt remote | PlayOverlay, Cuetools | 1 termékbe zárt 1:1 / sync |
| Signage | Signage Remote, Booth Beam | Egér / tartalom a playeren |
| Audience app | Mentimeter, Slido | Kész poll/Q&A, nem SDK |
| Helyszín HW | Kazo, Sportdata | Drága zárt stack |

## Rés

Együtt ritka: **3 szerep + topológia módok + fail-closed üzenetkatalog + média ugyanazon sessionben + embed bármely hostba + LAN/self-host**.

- Interaxo: tipikusan screen↔phone, usage credit, nincs Observer/katalog/ViewGroup mag  
- LiveKit: media-first room, nem eszköz-szerepréteg  
- PlayOverlay stb.: UX igen, nyitott SDK nem  

**Pozíció:** horizontális role-mesh platform (karate = referencia / GTM, nem a piac határa).

## Profi videobíró / pontozás (karate és hasonlók)

- **Kazo Vision PARROT** + Ultra Score — multi-cam SDI, nonstop record, slow-mo, pontozás overlay
- **Sportdata SET Video Review** — multi/IP cam, event integráció, WKF-közeli stack
- **slomo.tv videoReferee** — általános sport VAR
- **WKF** szabály: tipikusan utolsó ~6 mp review, döntés ~30 mp alatt

Ezek **zárt, drága, helyszíni** rendszerek — nem beágyazható webmodulok. WTP-t validálnak; nem SDK-konkurensek.

## Telefon → kijelző remote (hasonló UX, más scope)

- PlayOverlay Phone remote, Cuetools Remote Link, ArenaCue Mobile
- Open source PoC-ok (pl. snooker WebRTC + QR)

Általában **1 termékbe zárt 1:1 remote**, nem általános N×M embed SDK.

## Böngészős continuous replay

- Profi: írás és olvasás szétválasztva (record nem áll le replay közben)
- Böngésző: chunkolt MediaRecorder + IndexedDB/OPFS; naiv WebM „gyűrűvágás” törékeny
- IP/RTSP ≠ getUserMedia — gateway kell

## SaaS irány (kutatás)

- **Eladni:** horizontális platform (project/site/concurrent flat), nem peer-minute CPaaS  
- **ISV + helyszín** fizet; vertical UI a host appé  
- Self-host / LAN first (magas margin) + opcionális cloud control plane  
- Kerülendő első SKU: LiveKit-klón percárazás

## Következtetés

- Ne Sportdata-klón; **szállítási + szerepréteg**, bármely vertical host  
- Első bizonyíték: demó + karate-szerű flow; piac: eszköz-összekötés általánosan  
