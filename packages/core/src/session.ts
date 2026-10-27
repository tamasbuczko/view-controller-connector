import { Emitter } from "./emitter.js";
import { toVccError, VccClientError } from "./errors.js";
import { PeerMesh } from "./peer-mesh.js";
import { SignalingClient } from "./signaling-client.js";
import type {
  ConnectionMode,
  IceServersConfig,
  MediaPublication,
  OutboundMessage,
  PairingTarget,
  PairPayload,
  PublishMediaOpts,
  RecordOpts,
  ReplayQuery,
  ReplaySession,
  Role,
  SessionEvents,
  SessionStatus,
  TopologySnapshot,
  VccConfig,
} from "./types.js";
import { validateConfig } from "./validate-config.js";

const DEFAULT_ICE: IceServersConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const emptyTopology = (sessionId = "", mode: ConnectionMode = "1-1"): TopologySnapshot => ({
  sessionId,
  mode,
  peers: [],
  groups: [],
  links: [],
});

export interface Session {
  readonly id: string | null;
  readonly role: Role | null;
  readonly mode: ConnectionMode | null;
  readonly status: SessionStatus;
  readonly sessionCode: string | null;
  readonly peerId: string | null;

  prepare(): Promise<void>;
  createAndActivate(opts?: { mode?: ConnectionMode }): Promise<{
    sessionId: string;
    sessionCode: string;
  }>;
  setMode(mode: ConnectionMode): Promise<void>;
  defineGroup(groupId: string, memberViewIds: string[]): Promise<void>;
  deactivate(): Promise<void>;
  joinWithCode(code: string, role: "view" | "controller"): Promise<void>;
  joinWithPairToken(tokenPayload: PairPayload): Promise<void>;
  pair(tokenPayload: PairPayload): Promise<void>;
  leave(): Promise<void>;
  kick(peerId: string, reason?: string): Promise<void>;
  getTopology(): TopologySnapshot;
  getPairingPayload(target: PairingTarget): PairPayload;
  showPairingQr(target: PairingTarget): void;
  hidePairingQr(target: PairingTarget): void;
  send(msg: OutboundMessage): Promise<void>;
  publishMedia(opts: PublishMediaOpts): Promise<MediaPublication>;
  unpublishMedia(publicationId: string): Promise<void>;
  startLocalRecording(opts?: RecordOpts): Promise<void>;
  stopLocalRecording(): Promise<void>;
  openReplay(query: ReplayQuery): Promise<ReplaySession>;
  on<E extends keyof SessionEvents>(
    event: E,
    handler: SessionEvents[E],
  ): () => void;
  destroy(): Promise<void>;
}

export function createSession(config: VccConfig): Session {
  validateConfig(config);
  return new SessionImpl(config);
}

class SessionImpl implements Session {
  private readonly config: VccConfig;
  private readonly emitter = new Emitter<SessionEvents>();
  private signaling: SignalingClient | null = null;

  private _id: string | null = null;
  private _role: Role | null = null;
  private _mode: ConnectionMode | null = null;
  private _status: SessionStatus = "idle";
  private _sessionCode: string | null = null;
  private _peerId: string | null = null;
  private topology: TopologySnapshot = emptyTopology();
  private mesh: PeerMesh | null = null;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private reqSeq = 0;
  private msgSeq = 0;

  constructor(config: VccConfig) {
    this.config = config;
  }

  get id(): string | null {
    return this._id;
  }
  get role(): Role | null {
    return this._role;
  }
  get mode(): ConnectionMode | null {
    return this._mode;
  }
  get status(): SessionStatus {
    return this._status;
  }
  get sessionCode(): string | null {
    return this._sessionCode;
  }
  get peerId(): string | null {
    return this._peerId;
  }

  on<E extends keyof SessionEvents>(
    event: E,
    handler: SessionEvents[E],
  ): () => void {
    return this.emitter.on(event, handler);
  }

  private setStatus(s: SessionStatus): void {
    this._status = s;
    this.emitter.emit("status", s);
  }

  private emitError(err: unknown): void {
    this.emitter.emit("error", toVccError(err));
  }

  async prepare(): Promise<void> {
    if (this._status === "preparing" || this._status === "active") return;
    this.setStatus("preparing");
    try {
      this.signaling = new SignalingClient(
        this.config.signaling.url,
        (msg) => this.handleSignal(msg),
        () => {
          if (this._status !== "closed" && this._status !== "idle") {
            this.emitError(
              new VccClientError(
                "SIGNALING_DISCONNECT",
                "signaling disconnected",
                { retryable: true },
              ),
            );
          }
        },
      );
      await this.signaling.connect();
      this.signaling.send({ type: "hello", protocol: 1 });
      this.setStatus("idle");
    } catch (e) {
      this.setStatus("idle");
      this.emitError(e);
      throw e;
    }
  }

  private ensureSignal(): SignalingClient {
    if (!this.signaling) {
      throw new VccClientError(
        "SIGNALING_DISCONNECT",
        "call prepare() first",
        { retryable: true },
      );
    }
    return this.signaling;
  }

  private request<T>(
    type: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const reqId = `r${++this.reqSeq}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(reqId, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      try {
        this.ensureSignal().send({ type, reqId, ...body });
      } catch (e) {
        this.pending.delete(reqId);
        reject(e);
      }
      setTimeout(() => {
        if (this.pending.has(reqId)) {
          this.pending.delete(reqId);
          reject(
            new VccClientError("SIGNALING_DISCONNECT", `timeout: ${type}`, {
              retryable: true,
            }),
          );
        }
      }, 15_000);
    });
  }

  private handleSignal(msg: Record<string, unknown>): void {
    const type = String(msg.type ?? "");
    const reqId = typeof msg.reqId === "string" ? msg.reqId : undefined;

    if (type === "error") {
      const err = new VccClientError(
        (msg.code as VccClientError["code"]) || "INTERNAL",
        String(msg.message ?? "signaling error"),
      );
      if (reqId && this.pending.has(reqId)) {
        this.pending.get(reqId)!.reject(err);
        this.pending.delete(reqId);
      } else {
        this.emitError(err);
      }
      return;
    }

    if (reqId && this.pending.has(reqId)) {
      this.pending.get(reqId)!.resolve(msg);
      this.pending.delete(reqId);
    }

    switch (type) {
      case "welcome":
        this._peerId = String(msg.peerId ?? "");
        break;
      case "topology":
        this.topology = msg.topology as TopologySnapshot;
        this.emitter.emit("topology", this.topology);
        this.ensureMesh()?.syncTopology(this.topology);
        break;
      case "peer.joined":
        this.emitter.emit("peerJoined", String(msg.peerId));
        break;
      case "peer.left":
        this.emitter.emit("peerLeft", String(msg.peerId), msg.reason as string | undefined);
        break;
      case "signal.relay": {
        const from = String(msg.fromPeerId ?? "");
        const payload = msg.payload as
          | { kind: "offer" | "answer" | "ice"; sdp?: string; candidate?: RTCIceCandidateInit | null }
          | undefined;
        if (from && payload?.kind && this.mesh) {
          void this.mesh.handleSignal(from, payload as never).catch((e) =>
            this.emitError(e),
          );
        }
        break;
      }
      case "data":
        // Fallback path only when dataRelayFallback is enabled.
        this.emitter.emit("message", {
          v: 1,
          id: String(msg.id ?? ""),
          name: String(msg.name ?? ""),
          type: String(msg.msgType ?? "event"),
          ts: Number(msg.ts ?? Date.now()),
          from: String(msg.from ?? ""),
          to: (msg.to as string | string[]) ?? "*",
          payload: msg.payload,
          delivery: (msg.delivery as "reliable" | "lossy") ?? "reliable",
        });
        break;
      case "pairing.closed": {
        const target = msg.target as PairingTarget;
        this.emitter.emit("pairingQr", {
          target,
          payload: {
            v: 1,
            sessionId: this._id ?? "",
            target,
            pairToken: "",
            signalingUrl: this.config.signaling.url,
            mode: this._mode ?? this.config.defaultMode,
            uri: "",
          },
          visible: false,
        });
        break;
      }
      default:
        break;
    }
  }

  async createAndActivate(opts?: {
    mode?: ConnectionMode;
  }): Promise<{ sessionId: string; sessionCode: string }> {
    const mode = opts?.mode ?? this.config.defaultMode;
    if (!this.config.allowedModes.includes(mode)) {
      throw new VccClientError("MODE_NOT_ALLOWED", `mode not allowed: ${mode}`);
    }
    const res = await this.request<Record<string, unknown>>("session.create", {
      mode,
    });
    this._id = String(res.sessionId);
    this._sessionCode = String(res.sessionCode);
    this._mode = mode;
    this._role = "observer";
    this.setStatus("active");
    this.topology = emptyTopology(this._id, mode);
    // Observer does not mesh for S4 data path (controllers ↔ views).
    return { sessionId: this._id, sessionCode: this._sessionCode };
  }

  async setMode(mode: ConnectionMode): Promise<void> {
    if (!this.config.allowedModes.includes(mode)) {
      throw new VccClientError("MODE_NOT_ALLOWED", `mode not allowed: ${mode}`);
    }
    await this.request("session.setMode", {
      sessionId: this._id,
      mode,
    });
    this._mode = mode;
  }

  async defineGroup(
    groupId: string,
    memberViewIds: string[],
  ): Promise<void> {
    await this.request("group.define", {
      sessionId: this._id,
      groupId,
      memberIds: memberViewIds,
    });
  }

  async deactivate(): Promise<void> {
    if (!this._id) return;
    await this.request("session.deactivate", { sessionId: this._id });
    this.setStatus("closed");
  }

  async joinWithCode(
    code: string,
    role: "view" | "controller",
  ): Promise<void> {
    const res = await this.request<Record<string, unknown>>("session.join", {
      code: code.trim().toUpperCase(),
      role,
    });
    this._id = String(res.sessionId);
    this._role = role;
    this._mode = res.mode as ConnectionMode;
    this._sessionCode = code.trim().toUpperCase();
    if (res.topology) {
      this.topology = res.topology as TopologySnapshot;
      this.emitter.emit("topology", this.topology);
    }
    this.setStatus("active");
    this.ensureMesh()?.syncTopology(this.topology);
  }

  async joinWithPairToken(tokenPayload: PairPayload): Promise<void> {
    const res = await this.request<Record<string, unknown>>("session.join", {
      pairToken: tokenPayload.pairToken,
      role: "controller",
      target: tokenPayload.target,
    });
    this._id = String(res.sessionId);
    this._role = "controller";
    this._mode = (res.mode as ConnectionMode) ?? tokenPayload.mode;
    if (res.topology) {
      this.topology = res.topology as TopologySnapshot;
      this.emitter.emit("topology", this.topology);
    }
    this.setStatus("active");
    this.ensureMesh()?.syncTopology(this.topology);
  }

  async pair(tokenPayload: PairPayload): Promise<void> {
    if (this._role !== "controller" || !this._id) {
      throw new VccClientError(
        "POLICY_DENIED",
        "pair() requires an active controller session",
      );
    }
    await this.request("session.pair", {
      sessionId: this._id,
      pairToken: tokenPayload.pairToken,
      target: tokenPayload.target,
    });
    this.ensureMesh()?.syncTopology(this.topology);
  }

  async leave(): Promise<void> {
    try {
      await this.request("peer.leave", {});
    } catch {
      // best effort
    }
    this.mesh?.close();
    this.mesh = null;
    this.setStatus("closed");
  }

  async kick(peerId: string, reason?: string): Promise<void> {
    const policy = this.config.disconnectPolicy;
    if (this._role === "observer") {
      // always allowed for observer under all policies that include observer
    } else if (
      this._role === "view" &&
      (policy === "observer+view" || policy === "observer+view+self-leave")
    ) {
      // ok
    } else {
      throw new VccClientError("POLICY_DENIED", "kick not allowed by policy");
    }
    await this.request("peer.kick", { peerId, reason });
  }

  getTopology(): TopologySnapshot {
    return this.topology;
  }

  getPairingPayload(_target: PairingTarget): PairPayload {
    if (!this._id || !this._mode) {
      throw new VccClientError("SESSION_NOT_FOUND", "no active session");
    }
    // Sync API cannot await mint; use showPairingQr → pairingQr event.
    throw new VccClientError(
      "NOT_IMPLEMENTED",
      "use showPairingQr() and listen for pairingQr (async mint)",
    );
  }

  showPairingQr(target: PairingTarget): void {
    void this.request<Record<string, unknown>>("pairing.mint", {
      sessionId: this._id,
      target,
    })
      .then((res) => {
        const payload = res.payload as PairPayload;
        this.emitter.emit("pairingQr", {
          target,
          payload,
          visible: true,
        });
      })
      .catch((e) => this.emitError(e));
  }

  hidePairingQr(target: PairingTarget): void {
    this.emitter.emit("pairingQr", {
      target,
      payload: {
        v: 1,
        sessionId: this._id ?? "",
        target,
        pairToken: "",
        signalingUrl: this.config.signaling.url,
        mode: this._mode ?? this.config.defaultMode,
        uri: "",
      },
      visible: false,
    });
  }

  async send(msg: OutboundMessage): Promise<void> {
    const entry = this.config.catalog.find((c) => c.name === msg.name);
    if (!entry) {
      throw new VccClientError(
        "NAME_NOT_IN_CATALOG",
        `unknown message name: ${msg.name}`,
      );
    }
    const envelope = {
      v: 1 as const,
      id: `m${++this.msgSeq}_${Date.now()}`,
      name: msg.name,
      type: entry.type,
      ts: Date.now(),
      to: (msg.to ?? "*") as string | string[],
      payload: msg.payload ?? null,
      delivery: (msg.delivery ?? entry.delivery ?? "reliable") as
        | "reliable"
        | "lossy",
    };

    const mesh = this.ensureMesh();
    if (mesh) {
      try {
        await mesh.sendJson(msg.to ?? "*", envelope);
        return;
      } catch (e) {
        if (!this.config.signaling.dataRelayFallback) throw e;
        // fall through to relay
      }
    } else if (!this.config.signaling.dataRelayFallback) {
      throw new VccClientError(
        "ICE_FAILED",
        "no PeerMesh (Observer cannot send over DataChannel; use View/Controller or enable dataRelayFallback)",
      );
    }

    await this.request("data.relay", {
      sessionId: this._id,
      name: msg.name,
      type: entry.type,
      payload: msg.payload ?? null,
      to: msg.to ?? "*",
      delivery: msg.delivery ?? entry.delivery ?? "reliable",
    });
  }

  private ensureMesh(): PeerMesh | null {
    if (this._role !== "view" && this._role !== "controller") return null;
    if (!this._peerId) return null;
    if (this.mesh) return this.mesh;
    const iceServers =
      this.config.media?.iceServers?.length
        ? this.config.media.iceServers
        : DEFAULT_ICE;
    this.mesh = new PeerMesh({
      localPeerId: this._peerId,
      role: this._role,
      iceServers,
      relaySignal: (toPeerId, payload) => {
        try {
          this.ensureSignal().send({
            type: "signal.relay",
            toPeerId,
            payload,
          });
        } catch (e) {
          this.emitError(e);
        }
      },
      onMessage: (m) => {
        if (m.name === "vcc.media.ended" && m.payload) {
          const publicationId = String(
            (m.payload as { publicationId?: string }).publicationId ?? "",
          );
          if (publicationId) {
            this.emitter.emit("trackEnded", publicationId, m.from);
          }
          return;
        }
        if (m.name === "vcc.media.meta") {
          // Reserved for richer track mapping; ontrack already emits.
          return;
        }
        this.emitter.emit("message", m);
      },
      onTrack: (e) => this.emitter.emit("track", e),
      onTrackEnded: (publicationId, from) =>
        this.emitter.emit("trackEnded", publicationId, from),
      onIceFailed: () => {
        this.emitError(
          new VccClientError("ICE_FAILED", "peer connection failed", {
            retryable: true,
          }),
        );
      },
    });
    return this.mesh;
  }

  async publishMedia(opts: PublishMediaOpts): Promise<MediaPublication> {
    const mesh = this.ensureMesh();
    if (!mesh) {
      throw new VccClientError(
        "POLICY_DENIED",
        "publishMedia requires View or Controller role with PeerMesh",
      );
    }

    let track = opts.track;
    let stream = opts.stream;
    if (!track) {
      try {
        if (opts.kind === "screen") {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        } else if (opts.kind === "microphone") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else if (opts.kind === "camera") {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw new VccClientError(
            "CONFIG_INVALID",
            "custom publishMedia requires track or stream",
          );
        }
        track = stream.getTracks()[0];
      } catch (e) {
        if (e instanceof VccClientError) throw e;
        throw new VccClientError(
          "MEDIA_DENIED",
          e instanceof Error ? e.message : "getUserMedia denied",
          { cause: e },
        );
      }
    }
    if (!track) {
      throw new VccClientError("MEDIA_DENIED", "no media track available");
    }
    if (!stream) {
      stream = new MediaStream([track]);
    }

    const pub = await mesh.publishTrack({
      kind: opts.kind,
      track,
      stream,
      to: opts.to,
      label: opts.label,
    });
    return {
      id: pub.id,
      kind: pub.kind,
      stream,
      stop: () => pub.stop(),
    };
  }

  async unpublishMedia(publicationId: string): Promise<void> {
    const mesh = this.mesh;
    if (!mesh) return;
    await mesh.unpublish(publicationId);
  }

  async startLocalRecording(_opts?: RecordOpts): Promise<void> {
    throw new VccClientError("NOT_IMPLEMENTED", "recording not ready");
  }

  async stopLocalRecording(): Promise<void> {
    throw new VccClientError("NOT_IMPLEMENTED", "recording not ready");
  }

  async openReplay(_query: ReplayQuery): Promise<ReplaySession> {
    throw new VccClientError("NOT_IMPLEMENTED", "replay not ready");
  }

  async destroy(): Promise<void> {
    this.setStatus("closing");
    try {
      await this.leave();
    } catch {
      /* ignore */
    }
    this.mesh?.close();
    this.mesh = null;
    this.signaling?.close();
    this.signaling = null;
    this.emitter.clear();
    this.pending.clear();
    this.setStatus("closed");
  }
}
