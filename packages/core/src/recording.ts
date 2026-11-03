import { VccClientError } from "./errors.js";
import type { RecordOpts, ReplayQuery, ReplaySession } from "./types.js";

/**
 * Continuous local MediaRecorder.
 *
 * Important: timeslice blobs are only valid when concatenated **in full order
 * from the init segment**. Slicing "last N seconds" of clusters while keeping
 * an old init causes Chrome to stick on the first frame. So we keep a rolling
 * recorder segment, and for replay we finalize → full Blob → seek to last N.
 */
export class LocalRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private parts: Blob[] = [];
  private active = false;
  private mimeType = "";
  private startedAt = 0;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxWindowMs: number;
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
  }

  get isActive(): boolean {
    return this.active;
  }

  get bufferedMs(): number {
    if (!this.active && !this.parts.length) return 0;
    return Math.max(0, Date.now() - this.startedAt);
  }

  start(stream: MediaStream, _opts?: RecordOpts): void {
    if (this.active) return;
    this.beginSegment(stream);
  }

  async stop(): Promise<void> {
    await this.finalizeSegment();
    this.stream = null;
    if (this.active) {
      this.active = false;
      this.onActiveChange?.(false);
    }
  }

  buildBlob(_query: ReplayQuery): Blob {
    if (!this.parts.length) {
      throw new VccClientError(
        "RECORDING_FAILED",
        "no recorded media yet — wait a few seconds after REC",
      );
    }
    const type = this.parts[0]?.type || this.mimeType || "video/webm";
    return new Blob(this.parts, { type });
  }

  async openReplay(query: ReplayQuery): Promise<ReplaySession> {
    if (!this.stream && !this.parts.length && !this.recorder) {
      throw new VccClientError(
        "RECORDING_FAILED",
        "no recorded media yet — wait a few seconds after REC",
      );
    }

    const wasActive = this.active;
    const stream = this.stream;

    // Finalize so Chrome emits a complete, playable WebM (not a cluster slice)
    await this.finalizeSegment();

    if (!this.parts.length) {
      throw new VccClientError(
        "RECORDING_FAILED",
        "no recorded media yet — wait a few seconds after REC",
      );
    }

    const blob = this.buildBlob(query);
    if (blob.size < 64) {
      throw new VccClientError(
        "RECORDING_FAILED",
        "recording buffer too small — wait longer",
      );
    }

    // Roll into a fresh segment so live REC continues
    if (wasActive && stream?.getTracks().some((t) => t.readyState === "live")) {
      this.parts = [];
      this.beginSegment(stream, true);
    } else if (wasActive) {
      this.active = false;
      this.onActiveChange?.(false);
    }

    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.playsInline = true;
    video.controls = false;
    video.preload = "auto";
    video.src = url;
    let closed = false;

    const lastSeconds = query.lastSeconds ?? 6;

    await prepareWebmPlayback(video, lastSeconds);

    const session: ReplaySession = {
      play() {
        void video.play().catch(() => {
          /* controls still work */
        });
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
          video.currentTime = Math.min(Math.max(0, t), video.duration);
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

  private beginSegment(stream: MediaStream, resume = false): void {
    if (typeof MediaRecorder === "undefined") {
      throw new VccClientError(
        "RECORDING_FAILED",
        "MediaRecorder not available",
      );
    }
    if (!stream.getTracks().length) {
      throw new VccClientError("RECORDING_FAILED", "no tracks to record");
    }
    if (!stream.getTracks().some((t) => t.readyState === "live")) {
      throw new VccClientError(
        "RECORDING_FAILED",
        "media tracks are not live",
      );
    }

    this.stream = stream;
    this.parts = [];
    this.mimeType = pickMime(stream);
    this.startedAt = Date.now();

    try {
      const rec = this.createRecorder(stream);
      this.recorder = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) this.parts.push(ev.data);
      };
      rec.onerror = () => {
        this.onError?.(
          new VccClientError("RECORDING_FAILED", "MediaRecorder error"),
        );
        void this.stop();
      };
      // No timeslice: one contiguous WebM until finalize (replay-safe)
      rec.start();
      if (!resume) {
        this.active = true;
        this.onActiveChange?.(true);
      } else {
        this.active = true;
      }
      this.startWatchdog();
      this.scheduleRoll();
    } catch (e) {
      this.clearWatchdog();
      throw new VccClientError(
        "RECORDING_FAILED",
        e instanceof Error ? e.message : "failed to start recorder",
        { cause: e },
      );
    }
  }

  /** Periodically finalize+restart so the buffer stays near maxWindow. */
  private rollTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleRoll(): void {
    if (this.rollTimer) clearTimeout(this.rollTimer);
    // Keep segments short enough that "last 6s" seek lands inside current file
    const rollMs = Math.min(this.maxWindowMs, 15_000);
    this.rollTimer = setTimeout(() => {
      void this.rollSegment();
    }, rollMs);
  }

  private async rollSegment(): Promise<void> {
    if (!this.active || !this.stream) return;
    const stream = this.stream;
    await this.finalizeSegment();
    // Drop previous segment — next replay uses the fresh window
    this.parts = [];
    if (stream.getTracks().some((t) => t.readyState === "live")) {
      this.beginSegment(stream, true);
    }
  }

  private async finalizeSegment(): Promise<void> {
    this.clearWatchdog();
    if (this.rollTimer) {
      clearTimeout(this.rollTimer);
      this.rollTimer = null;
    }
    const rec = this.recorder;
    this.recorder = null;
    if (!rec || rec.state === "inactive") return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      rec.addEventListener("stop", done, { once: true });
      try {
        rec.requestData();
      } catch {
        /* ignore */
      }
      try {
        rec.stop();
      } catch {
        resolve();
      }
      setTimeout(resolve, 1500);
    });
  }

  private createRecorder(stream: MediaStream): MediaRecorder {
    const tryMime = (mime: string) => {
      const opts: MediaRecorderOptions = {};
      if (mime) opts.mimeType = mime;
      return new MediaRecorder(stream, opts);
    };
    try {
      return tryMime(this.mimeType);
    } catch {
      this.mimeType = "";
      return tryMime("");
    }
  }

  private startWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (!this.active || this.parts.length) return;
      const stream = this.stream;
      if (!stream || !this.recorder) return;
      try {
        const old = this.recorder;
        old.ondataavailable = null;
        if (old.state !== "inactive") old.stop();
      } catch {
        /* ignore */
      }
      this.mimeType = pickMime(stream, true);
      try {
        const rec = this.createRecorder(stream);
        this.recorder = rec;
        this.parts = [];
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) this.parts.push(ev.data);
        };
        rec.onerror = () => {
          this.onError?.(
            new VccClientError("RECORDING_FAILED", "MediaRecorder error"),
          );
          void this.stop();
        };
        rec.start();
        this.scheduleRoll();
      } catch (e) {
        this.onError?.(
          new VccClientError(
            "RECORDING_FAILED",
            e instanceof Error ? e.message : "recorder restart failed",
            { cause: e },
          ),
        );
      }
    }, 2000);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}

/**
 * MediaRecorder WebM often reports duration=Infinity and appears frozen on
 * frame 0 until we force Chrome to compute duration, then seek to last N.
 */
function prepareWebmPlayback(
  video: HTMLVideoElement,
  lastSeconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const dur = video.duration;
      if (Number.isFinite(dur) && dur > 0) {
        video.currentTime = Math.max(0, dur - lastSeconds);
      }
      resolve();
    };

    const forceDuration = () => {
      if (done) return;
      if (Number.isFinite(video.duration) && video.duration !== Infinity) {
        finish();
        return;
      }
      const cleanup = () => {
        video.removeEventListener("timeupdate", cleanup);
        video.removeEventListener("seeked", cleanup);
        finish();
      };
      video.addEventListener("timeupdate", cleanup);
      video.addEventListener("seeked", cleanup);
      try {
        video.currentTime = 1e101;
      } catch {
        finish();
      }
      setTimeout(finish, 900);
    };

    if (video.readyState >= 1) forceDuration();
    else {
      video.addEventListener("loadedmetadata", forceDuration, { once: true });
      setTimeout(forceDuration, 1200);
    }
  });
}

function pickMime(stream?: MediaStream, videoOnlyForce = false): string {
  if (typeof MediaRecorder === "undefined") return "";
  const hasAudio =
    !videoOnlyForce &&
    !!stream?.getAudioTracks().some((t) => t.readyState === "live");
  const withAudio = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const videoOnly = [
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm",
    "video/mp4",
  ];
  for (const m of hasAudio ? withAudio : videoOnly) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}
