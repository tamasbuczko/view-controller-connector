import { VccClientError } from "./errors.js";
import type { RecordOpts, ReplayQuery, ReplaySession } from "./types.js";

interface Chunk {
  blob: Blob;
  startedAt: number;
  endedAt: number;
}

/**
 * Continuous local MediaRecorder with a time-based chunk ring.
 * Live capture is independent of replay (separate Blob URL / video element).
 */
export class LocalRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Chunk[] = [];
  private chunkStartedAt = 0;
  private active = false;
  private readonly maxWindowMs: number;
  private readonly mimeType: string;
  private onActiveChange?: (active: boolean) => void;
  private onError?: (e: unknown) => void;

  constructor(opts?: {
    maxWindowSeconds?: number;
    onActiveChange?: (active: boolean) => void;
    onError?: (e: unknown) => void;
  }) {
    this.maxWindowMs = (opts?.maxWindowSeconds ?? 60) * 1000;
    this.onActiveChange = opts?.onActiveChange;
    this.onError = opts?.onError;
    this.mimeType = pickMime();
  }

  get isActive(): boolean {
    return this.active;
  }

  start(stream: MediaStream, _opts?: RecordOpts): void {
    if (this.active) return;
    if (typeof MediaRecorder === "undefined") {
      throw new VccClientError(
        "RECORDING_FAILED",
        "MediaRecorder not available",
      );
    }
    if (!stream.getTracks().length) {
      throw new VccClientError("RECORDING_FAILED", "no tracks to record");
    }

    this.stream = stream;
    this.chunks = [];
    try {
      const rec = new MediaRecorder(stream, {
        mimeType: this.mimeType || undefined,
      });
      this.recorder = rec;
      this.chunkStartedAt = Date.now();
      rec.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        const endedAt = Date.now();
        this.chunks.push({
          blob: ev.data,
          startedAt: this.chunkStartedAt,
          endedAt,
        });
        this.chunkStartedAt = endedAt;
        this.trim();
      };
      rec.onerror = () => {
        this.onError?.(
          new VccClientError("RECORDING_FAILED", "MediaRecorder error"),
        );
        void this.stop();
      };
      // timeslice → continuous chunks without stopping live capture
      rec.start(500);
      this.active = true;
      this.onActiveChange?.(true);
    } catch (e) {
      throw new VccClientError(
        "RECORDING_FAILED",
        e instanceof Error ? e.message : "failed to start recorder",
        { cause: e },
      );
    }
  }

  async stop(): Promise<void> {
    const rec = this.recorder;
    this.recorder = null;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        try {
          rec.requestData();
          rec.stop();
        } catch {
          resolve();
        }
        setTimeout(resolve, 1000);
      });
    }
    if (this.active) {
      this.active = false;
      this.onActiveChange?.(false);
    }
  }

  /** Build a Blob covering approximately the last `windowSeconds` (or query range). */
  buildBlob(query: ReplayQuery): Blob {
    this.trim();
    const now = Date.now();
    let from = query.fromTs;
    let to = query.toTs ?? now;
    if (query.lastSeconds != null) {
      from = now - query.lastSeconds * 1000;
      to = now;
    }
    if (from == null) {
      from = now - Math.min(this.maxWindowMs, 6_000);
    }
    const selected = this.chunks.filter(
      (c) => c.endedAt >= from! && c.startedAt <= to!,
    );
    if (!selected.length) {
      throw new VccClientError(
        "RECORDING_FAILED",
        "no recorded media in requested window",
      );
    }
    const type = selected[0].blob.type || this.mimeType || "video/webm";
    return new Blob(
      selected.map((c) => c.blob),
      { type },
    );
  }

  openReplay(query: ReplayQuery): ReplaySession {
    const blob = this.buildBlob(query);
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.playsInline = true;
    video.controls = false;
    let closed = false;

    const session: ReplaySession = {
      play() {
        void video.play();
      },
      pause() {
        video.pause();
      },
      setRate(rate: number) {
        video.playbackRate = Math.min(2, Math.max(0.25, rate));
      },
      seek(offsetMs: number) {
        const t = offsetMs / 1000;
        if (Number.isFinite(video.duration)) {
          video.currentTime = Math.min(
            Math.max(0, t),
            Number.isFinite(video.duration) ? video.duration : t,
          );
        } else {
          video.currentTime = Math.max(0, t);
        }
      },
      getElement() {
        return closed ? null : video;
      },
      close() {
        if (closed) return;
        closed = true;
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
      },
    };
    return session;
  }

  private trim(): void {
    const cutoff = Date.now() - this.maxWindowMs;
    while (this.chunks.length && this.chunks[0].endedAt < cutoff) {
      this.chunks.shift();
    }
  }
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}
