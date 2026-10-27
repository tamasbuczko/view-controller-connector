# VCC publikus API — v1 zárolt felület

Ez a szerződés a **teljes modulra** vonatkozik. Implementáció ezt valósítja meg; breaking change csak major verzióval.

```ts
// @vcc/core — fő belépési pontok
```

## 1. Konfiguráció

```ts
type ConnectionMode = "1-1" | "1-n" | "n-1" | "n-n";
type DisconnectPolicy =
  | "observer-only"
  | "observer+view"
  | "observer+view+self-leave";
type ConflictStrategy =
  | "last-write-wins"
  | "active-lock"
  | "media-exclusive";
type Delivery = "reliable" | "lossy";

interface IceServersConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface VccConfig {
  signaling: {
    adapter: "websocket" | "php-poll";
    url: string; // wss://... vagy https://.../vcc-poll
  };
  media?: {
    transport: "p2p" | "sfu"; // v1: p2p implementált; sfu adapter slot
    iceServers?: IceServersConfig[];
  };
  allowedModes: ConnectionMode[];
  defaultMode: ConnectionMode;
  disconnectPolicy: DisconnectPolicy;
  groupTemplates: Array<{
    id: string;
    label?: string;
    maxMembers: number;
    memberRoles?: ["view"]; // v1: csak view tagok
  }>;
  /** Engedélyezett üzenet/feature nevek — fail-closed */
  catalog: Array<{
    name: string;
    type: "event" | "feature" | "asset" | "state" | "system";
    delivery?: Delivery; // default reliable
    payloadSchema?: unknown; // JSON Schema opcionális
  }>;
  featureConflict?: Record<string, ConflictStrategy>;
  /** max peers soft limit (Observer figyelmeztet) */
  limits?: { maxPeers?: number; maxCameras?: number };
}
```

## 2. Session életciklus

```ts
interface Session {
  readonly id: string | null;
  readonly role: "observer" | "view" | "controller" | null;
  readonly mode: ConnectionMode | null;
  readonly status: "idle" | "preparing" | "active" | "closing" | "closed";

  prepare(): Promise<void>;
  /** Observer */
  createAndActivate(opts?: { mode?: ConnectionMode }): Promise<{
    sessionId: string;
    sessionCode: string; // rövid kód
  }>;
  setMode(mode: ConnectionMode): Promise<void>; // csak allowedModes
  defineGroup(groupId: string, memberViewIds: string[]): Promise<void>;
  deactivate(): Promise<void>;

  /** View / Controller */
  joinWithCode(code: string, role: "view" | "controller"): Promise<void>;
  /** Session join + párosítás egy lépésben (QR deep link) */
  joinWithPairToken(tokenPayload: PairPayload): Promise<void>;
  /** Controller: már a sessionben van (kód), ezután QR → link(ek) a targethez */
  pair(tokenPayload: PairPayload): Promise<void>;

  leave(): Promise<void>;
  kick(peerId: string, reason?: string): Promise<void>; // policy szerint

  getTopology(): TopologySnapshot;
  getPairingPayload(target: PairingTarget): PairPayload; // QR forrás
  showPairingQr(target: PairingTarget): void; // UI hook / event
  hidePairingQr(target: PairingTarget): void;

  send(msg: OutboundMessage): Promise<void>;
  publishMedia(opts: PublishMediaOpts): Promise<MediaPublication>;
  unpublishMedia(publicationId: string): Promise<void>;

  /** Videobíró View — continuous buffer */
  startLocalRecording(opts?: RecordOpts): Promise<void>;
  stopLocalRecording(): Promise<void>;
  openReplay(query: ReplayQuery): Promise<ReplaySession>;

  on<E extends keyof SessionEvents>(event: E, handler: SessionEvents[E]): () => void;
  destroy(): Promise<void>;
}

function createSession(config: VccConfig): Session;
```

## 3. Üzenetek

```ts
interface OutboundMessage {
  name: string; // catalogban kell lennie
  payload?: unknown;
  to?: string | string[] | "*"; // peerId | groupId | *
  delivery?: Delivery;
}

interface InboundMessage {
  v: 1;
  id: string;
  name: string;
  type: string;
  ts: number;
  from: string;
  to: string | string[];
  payload: unknown;
  delivery: Delivery;
  replyTo?: string;
}
```

## 4. Média

```ts
interface PublishMediaOpts {
  kind: "camera" | "microphone" | "screen" | "custom";
  track?: MediaStreamTrack;
  stream?: MediaStream;
  to?: string | string[] | "*"; // view célok
  label?: string;
}

interface MediaPublication {
  id: string;
  kind: string;
  stop(): Promise<void>;
}

interface RemoteTrackEvent {
  track: MediaStreamTrack;
  stream: MediaStream;
  from: string;
  publicationId: string;
  label?: string;
}
```

## 5. Replay (teljes modul — API a v1-ben)

```ts
interface RecordOpts {
  /** gyűrűbuffer hossza mp-ben; default 120 */
  windowSeconds?: number;
  trackIds?: string[]; // üres = összes remote video a View-n
}

interface ReplayQuery {
  /** WKF-szerű: utolsó N mp; default 6 */
  lastSeconds?: number;
  fromTs?: number;
  toTs?: number;
  trackIds?: string[];
}

interface ReplaySession {
  play(): void;
  pause(): void;
  setRate(rate: number): void; // 0.25 … 1 … 2
  seek(offsetMs: number): void;
  getElement(): HTMLVideoElement | null; // vagy multi-angle handle
  close(): void;
}
```

Felvétel **helye:** a hívó eszköz (gyakorlatban videobíró View). Élő stream közben a record nem áll le.

## 6. Párosítás

```ts
type PairingTarget =
  | { type: "view"; viewId: string }
  | { type: "group"; groupId: string };

interface PairPayload {
  v: 1;
  sessionId: string;
  target: PairingTarget;
  pairToken: string;
  signalingUrl: string;
  mode: ConnectionMode;
  /** deep link string / QR tartalom */
  uri: string;
}
```

## 7. Topológia

```ts
interface TopologySnapshot {
  sessionId: string;
  mode: ConnectionMode;
  peers: Array<{
    id: string;
    role: "observer" | "view" | "controller";
    label?: string;
    groups: string[];
  }>;
  groups: Array<{ id: string; members: string[] }>;
  links: Array<{ controllerId: string; viewId: string; state: "pairing" | "connected" | "failed" }>;
}
```

## 8. Események (LiveKit-szerű)

```ts
interface SessionEvents {
  status: (s: Session["status"]) => void;
  topology: (t: TopologySnapshot) => void;
  message: (m: InboundMessage) => void;
  track: (e: RemoteTrackEvent) => void;
  trackEnded: (publicationId: string, from: string) => void;
  pairingQr: (e: { target: PairingTarget; payload: PairPayload; visible: boolean }) => void;
  peerJoined: (peerId: string) => void;
  peerLeft: (peerId: string, reason?: string) => void;
  conflict: (e: { name: string; strategy: ConflictStrategy; winnerPeerId?: string }) => void;
  error: (e: VccError) => void;
  recording: (e: { active: boolean }) => void;
}
```

## 9. Hibák

```ts
type VccErrorCode =
  | "CONFIG_INVALID"
  | "MODE_NOT_ALLOWED"
  | "SESSION_NOT_FOUND"
  | "TOKEN_INVALID"
  | "TOKEN_CONSUMED"
  | "POLICY_DENIED"
  | "NAME_NOT_IN_CATALOG"
  | "TARGET_OUT_OF_SCOPE"
  | "SIGNALING_DISCONNECT"
  | "ICE_FAILED"
  | "MEDIA_DENIED"
  | "RECORDING_FAILED"
  | "NOT_IMPLEMENTED" // pl. sfu / php-poll adapter még nincs bekötve
  | "INTERNAL";

interface VccError {
  code: VccErrorCode;
  message: string;
  retryable?: boolean;
  cause?: unknown;
}
```

## 10. UI csomag (`@vcc/ui`)

```ts
mountObserver(el: HTMLElement, session: Session, opts?: ObserverUiOpts): Unmount;
mountView(el: HTMLElement, session: Session, opts?: ViewUiOpts): Unmount;
mountController(el: HTMLElement, session: Session, opts?: ControllerUiOpts): Unmount;
```

A demó ezeket használja; a host cserélheti saját UI-ra ugyanarra a `Session`-re.

## 11. Stabilítási szabály

- Új opcionális mező: minor OK  
- Meglévő mező törlése / jelentésváltás: **major**  
- Új `VccErrorCode`: minor  
- Catalog `name` stringek host-domain — nem a core breakingje  
