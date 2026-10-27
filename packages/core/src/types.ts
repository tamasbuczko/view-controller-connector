/** Locked public types — see docs/api-surface.md */

export type ConnectionMode = "1-1" | "1-n" | "n-1" | "n-n";
export type Role = "observer" | "view" | "controller";
export type DisconnectPolicy =
  | "observer-only"
  | "observer+view"
  | "observer+view+self-leave";
export type ConflictStrategy =
  | "last-write-wins"
  | "active-lock"
  | "media-exclusive";
export type Delivery = "reliable" | "lossy";
export type SessionStatus =
  | "idle"
  | "preparing"
  | "active"
  | "closing"
  | "closed";

export type VccErrorCode =
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
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

export interface VccError {
  code: VccErrorCode;
  message: string;
  retryable?: boolean;
  cause?: unknown;
}

export interface IceServersConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CatalogEntry {
  name: string;
  type: "event" | "feature" | "asset" | "state" | "system";
  delivery?: Delivery;
  payloadSchema?: unknown;
}

export interface GroupTemplate {
  id: string;
  label?: string;
  maxMembers: number;
  memberRoles?: ["view"];
}

export interface VccConfig {
  signaling: {
    adapter: "websocket" | "php-poll";
    url: string;
  };
  media?: {
    transport: "p2p" | "sfu";
    iceServers?: IceServersConfig[];
  };
  allowedModes: ConnectionMode[];
  defaultMode: ConnectionMode;
  disconnectPolicy: DisconnectPolicy;
  groupTemplates: GroupTemplate[];
  catalog: CatalogEntry[];
  featureConflict?: Record<string, ConflictStrategy>;
  limits?: { maxPeers?: number; maxCameras?: number };
}

export type PairingTarget =
  | { type: "view"; viewId: string }
  | { type: "group"; groupId: string };

export interface PairPayload {
  v: 1;
  sessionId: string;
  target: PairingTarget;
  pairToken: string;
  signalingUrl: string;
  mode: ConnectionMode;
  uri: string;
}

export interface TopologySnapshot {
  sessionId: string;
  mode: ConnectionMode;
  peers: Array<{
    id: string;
    role: Role;
    label?: string;
    groups: string[];
  }>;
  groups: Array<{ id: string; members: string[] }>;
  links: Array<{
    controllerId: string;
    viewId: string;
    state: "pairing" | "connected" | "failed";
  }>;
}

export interface OutboundMessage {
  name: string;
  payload?: unknown;
  to?: string | string[] | "*";
  delivery?: Delivery;
}

export interface InboundMessage {
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

export interface PublishMediaOpts {
  kind: "camera" | "microphone" | "screen" | "custom";
  track?: MediaStreamTrack;
  stream?: MediaStream;
  to?: string | string[] | "*";
  label?: string;
}

export interface MediaPublication {
  id: string;
  kind: string;
  stop(): Promise<void>;
}

export interface RemoteTrackEvent {
  track: MediaStreamTrack;
  stream: MediaStream;
  from: string;
  publicationId: string;
  label?: string;
}

export interface RecordOpts {
  windowSeconds?: number;
  trackIds?: string[];
}

export interface ReplayQuery {
  lastSeconds?: number;
  fromTs?: number;
  toTs?: number;
  trackIds?: string[];
}

export interface ReplaySession {
  play(): void;
  pause(): void;
  setRate(rate: number): void;
  seek(offsetMs: number): void;
  getElement(): HTMLVideoElement | null;
  close(): void;
}

export interface SessionEvents {
  status: (s: SessionStatus) => void;
  topology: (t: TopologySnapshot) => void;
  message: (m: InboundMessage) => void;
  track: (e: RemoteTrackEvent) => void;
  trackEnded: (publicationId: string, from: string) => void;
  pairingQr: (e: {
    target: PairingTarget;
    payload: PairPayload;
    visible: boolean;
  }) => void;
  peerJoined: (peerId: string) => void;
  peerLeft: (peerId: string, reason?: string) => void;
  conflict: (e: {
    name: string;
    strategy: ConflictStrategy;
    winnerPeerId?: string;
  }) => void;
  error: (e: VccError) => void;
  recording: (e: { active: boolean }) => void;
}
