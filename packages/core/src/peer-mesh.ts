import { VccClientError } from "./errors.js";
import type {
  IceServersConfig,
  InboundMessage,
  RemoteTrackEvent,
  TopologySnapshot,
} from "./types.js";

type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit | null };

export interface PeerMeshOpts {
  localPeerId: string;
  role: "observer" | "view" | "controller";
  iceServers: IceServersConfig[];
  relaySignal: (toPeerId: string, payload: SignalPayload) => void;
  onMessage: (msg: InboundMessage) => void;
  onTrack: (e: RemoteTrackEvent) => void;
  onTrackEnded: (publicationId: string, from: string) => void;
  onIceFailed?: (remotePeerId: string) => void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Controller is impolite offerer; View is polite. */
  polite: boolean;
  /** senderId → publicationId for local publishes on this PC */
  senders: Map<string, RTCRtpSender>;
}

interface LocalPublication {
  id: string;
  kind: string;
  label?: string;
  track: MediaStreamTrack;
  stream: MediaStream;
  targets: string[];
}

const DC_LABEL = "vcc";

export class PeerMesh {
  private readonly opts: PeerMeshOpts;
  private readonly peers = new Map<string, PeerEntry>();
  private readonly publications = new Map<string, LocalPublication>();
  private pubSeq = 0;
  private closed = false;

  constructor(opts: PeerMeshOpts) {
    this.opts = opts;
  }

  /** Sync mesh to topology links involving the local peer. */
  syncTopology(topology: TopologySnapshot): void {
    if (this.closed) return;
    const wanted = new Set<string>();
    for (const link of topology.links) {
      if (link.state === "failed") continue;
      if (link.controllerId === this.opts.localPeerId) {
        wanted.add(link.viewId);
      } else if (link.viewId === this.opts.localPeerId) {
        wanted.add(link.controllerId);
      }
    }
    for (const id of wanted) {
      void this.ensurePeer(id);
    }
    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this.teardownPeer(id);
    }
  }

  async handleSignal(fromPeerId: string, payload: SignalPayload): Promise<void> {
    if (this.closed) return;
    const entry = await this.ensurePeer(fromPeerId);
    const { pc } = entry;

    try {
      if (payload.kind === "offer") {
        const offerCollision =
          entry.makingOffer || pc.signalingState !== "stable";
        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.opts.relaySignal(fromPeerId, {
          kind: "answer",
          sdp: answer.sdp ?? "",
        });
      } else if (payload.kind === "answer") {
        await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      } else if (payload.kind === "ice") {
        if (payload.candidate) {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            if (!entry.ignoreOffer) throw new Error("addIceCandidate failed");
          }
        } else {
          await pc.addIceCandidate(null);
        }
      }
    } catch (e) {
      this.opts.onIceFailed?.(fromPeerId);
      throw e;
    }
  }

  async sendJson(
    to: string | string[] | "*",
    envelope: Omit<InboundMessage, "from"> & { from?: string },
  ): Promise<void> {
    const targets =
      to === "*"
        ? [...this.peers.keys()]
        : Array.isArray(to)
          ? to
          : [to];

    if (targets.length === 0) {
      throw new VccClientError(
        "TARGET_OUT_OF_SCOPE",
        "no linked peers for DataChannel send",
      );
    }

    const body = JSON.stringify({
      ...envelope,
      from: envelope.from ?? this.opts.localPeerId,
    });

    const errors: string[] = [];
    for (const id of targets) {
      try {
        const entry = await this.ensurePeer(id);
        const dc = await this.waitDc(entry, 10_000);
        if (dc.readyState !== "open") {
          errors.push(`${id}: dc ${dc.readyState}`);
          continue;
        }
        dc.send(body);
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (errors.length === targets.length) {
      throw new VccClientError(
        "ICE_FAILED",
        `DataChannel send failed: ${errors.join("; ")}`,
        { retryable: true },
      );
    }
  }

  async publishTrack(opts: {
    kind: string;
    track: MediaStreamTrack;
    stream: MediaStream;
    to?: string | string[] | "*";
    label?: string;
  }): Promise<{ id: string; kind: string; stop: () => Promise<void> }> {
    // Use MediaStreamTrack.id so remote ontrack / trackEnded line up.
    const id = opts.track.id || `pub_${++this.pubSeq}_${Date.now()}`;
    const targets =
      opts.to === undefined || opts.to === "*"
        ? [...this.peers.keys()]
        : Array.isArray(opts.to)
          ? opts.to
          : [opts.to];
    if (targets.length === 0) {
      throw new VccClientError(
        "TARGET_OUT_OF_SCOPE",
        "no linked peers for publishMedia",
      );
    }

    const pub: LocalPublication = {
      id,
      kind: opts.kind,
      label: opts.label,
      track: opts.track,
      stream: opts.stream,
      targets,
    };
    this.publications.set(id, pub);

    for (const remoteId of targets) {
      const entry = await this.ensurePeer(remoteId);
      const sender = entry.pc.addTrack(opts.track, opts.stream);
      entry.senders.set(id, sender);
      // Meta so receiver can map track → publicationId
      void this.sendJson(remoteId, {
        v: 1,
        id: `meta_${id}`,
        name: "vcc.media.meta",
        type: "system",
        ts: Date.now(),
        to: remoteId,
        payload: {
          publicationId: id,
          kind: opts.kind,
          label: opts.label,
          trackId: opts.track.id,
        },
        delivery: "reliable",
      }).catch(() => {
        /* meta best-effort; track still flows */
      });
      await this.makeOffer(remoteId, entry);
    }

    opts.track.addEventListener("ended", () => {
      void this.unpublish(id);
    });

    return {
      id,
      kind: opts.kind,
      stop: () => this.unpublish(id),
    };
  }

  async unpublish(publicationId: string): Promise<void> {
    const pub = this.publications.get(publicationId);
    if (!pub) return;
    this.publications.delete(publicationId);

    for (const remoteId of pub.targets) {
      const entry = this.peers.get(remoteId);
      if (!entry) continue;
      const sender = entry.senders.get(publicationId);
      if (sender) {
        try {
          entry.pc.removeTrack(sender);
        } catch {
          /* ignore */
        }
        entry.senders.delete(publicationId);
      }
      void this.sendJson(remoteId, {
        v: 1,
        id: `end_${publicationId}`,
        name: "vcc.media.ended",
        type: "system",
        ts: Date.now(),
        to: remoteId,
        payload: { publicationId },
        delivery: "reliable",
      }).catch(() => undefined);
      void this.makeOffer(remoteId, entry);
    }

    try {
      pub.track.stop();
    } catch {
      /* ignore */
    }
  }

  close(): void {
    this.closed = true;
    for (const id of [...this.publications.keys()]) {
      void this.unpublish(id);
    }
    for (const id of [...this.peers.keys()]) this.teardownPeer(id);
  }

  private iceConfig(): RTCConfiguration {
    return {
      iceServers: this.opts.iceServers.map((s) => ({
        urls: s.urls,
        username: s.username,
        credential: s.credential,
      })),
    };
  }

  private async ensurePeer(remoteId: string): Promise<PeerEntry> {
    const existing = this.peers.get(remoteId);
    if (existing) return existing;

    if (typeof RTCPeerConnection === "undefined") {
      throw new VccClientError(
        "NOT_IMPLEMENTED",
        "RTCPeerConnection unavailable in this runtime",
      );
    }

    const polite = this.opts.role !== "controller";
    const pc = new RTCPeerConnection(this.iceConfig());
    const entry: PeerEntry = {
      pc,
      dc: null,
      makingOffer: false,
      ignoreOffer: false,
      polite,
      senders: new Map(),
    };
    this.peers.set(remoteId, entry);

    pc.onicecandidate = (ev) => {
      this.opts.relaySignal(remoteId, {
        kind: "ice",
        candidate: ev.candidate ? ev.candidate.toJSON() : null,
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        this.opts.onIceFailed?.(remoteId);
      }
    };

    pc.ontrack = (ev) => {
      const track = ev.track;
      const stream = ev.streams[0] ?? new MediaStream([track]);
      const publicationId = track.id;
      this.opts.onTrack({
        track,
        stream,
        from: remoteId,
        publicationId,
        label: track.label,
      });
      track.addEventListener("ended", () => {
        this.opts.onTrackEnded(publicationId, remoteId);
      });
    };

    pc.ondatachannel = (ev) => {
      if (ev.channel.label === DC_LABEL) {
        this.bindDc(entry, ev.channel);
      }
    };

    // Attach any already-published local tracks to a newly linked peer.
    for (const pub of this.publications.values()) {
      if (pub.targets.includes(remoteId) || pub.targets.length === 0) {
        const sender = pc.addTrack(pub.track, pub.stream);
        entry.senders.set(pub.id, sender);
      }
    }

    if (!polite) {
      // Controller creates the DataChannel and offers.
      const dc = pc.createDataChannel(DC_LABEL, { ordered: true });
      this.bindDc(entry, dc);
      void this.makeOffer(remoteId, entry);
    }

    return entry;
  }

  private async makeOffer(remoteId: string, entry: PeerEntry): Promise<void> {
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      this.opts.relaySignal(remoteId, {
        kind: "offer",
        sdp: offer.sdp ?? "",
      });
    } catch {
      this.opts.onIceFailed?.(remoteId);
    } finally {
      entry.makingOffer = false;
    }
  }

  private bindDc(entry: PeerEntry, dc: RTCDataChannel): void {
    entry.dc = dc;
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as InboundMessage;
        this.opts.onMessage(msg);
      } catch {
        /* ignore malformed */
      }
    };
  }

  private waitDc(entry: PeerEntry, ms: number): Promise<RTCDataChannel> {
    if (entry.dc && entry.dc.readyState === "open") {
      return Promise.resolve(entry.dc);
    }
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (entry.dc?.readyState === "open") {
          resolve(entry.dc);
          return;
        }
        if (Date.now() - start > ms) {
          reject(new Error("DataChannel open timeout"));
          return;
        }
        setTimeout(tick, 50);
      };
      if (entry.dc) {
        entry.dc.addEventListener("open", () => resolve(entry.dc!), {
          once: true,
        });
      }
      tick();
    });
  }

  private teardownPeer(remoteId: string): void {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try {
      entry.dc?.close();
    } catch {
      /* ignore */
    }
    try {
      entry.pc.close();
    } catch {
      /* ignore */
    }
    this.peers.delete(remoteId);
  }
}
