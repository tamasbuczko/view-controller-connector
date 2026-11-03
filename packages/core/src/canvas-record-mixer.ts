/**
 * Build a local MediaStream for MediaRecorder from already-playing preview
 * <video> elements (the ones showing live WebRTC). Drawing those into a canvas
 * avoids track.clone() black-frames and dual-sink freezes.
 */
export class CanvasRecordMixer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly videos: HTMLVideoElement[] = [];
  private raf = 0;
  private stream: MediaStream | null = null;
  private stopped = false;
  private hasDrawnFrame = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1280;
    this.canvas.height = 720;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("2d canvas unavailable");
    }
    this.ctx = ctx;
  }

  /**
   * Composite playing preview videos into canvas.captureStream.
   * Does not take ownership of the video elements.
   */
  startFromVideos(videos: HTMLVideoElement[], fps = 0): MediaStream {
    this.stopCapture();
    this.stopped = false;
    this.hasDrawnFrame = false;
    this.videos.length = 0;

    for (const v of videos) {
      if (v && v.readyState >= 1) this.videos.push(v);
    }
    if (!this.videos.length) {
      // Allow not-yet-ready videos — still attach and wait
      for (const v of videos) {
        if (v) this.videos.push(v);
      }
    }
    if (!this.videos.length) {
      throw new Error("no preview videos for canvas mixer");
    }

    // Single tile: prefer element.captureStream (real decoded frames)
    if (
      this.videos.length === 1 &&
      typeof this.videos[0].captureStream === "function"
    ) {
      this.stream = this.videos[0].captureStream(fps || 25);
      this.hasDrawnFrame = this.videos[0].readyState >= 2;
      return this.stream;
    }

    this.ctx.fillStyle = "#12140f";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const draw = () => {
      if (this.stopped) return;
      const n = this.videos.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const tw = cw / cols;
      const th = ch / rows;
      this.ctx.fillStyle = "#12140f";
      this.ctx.fillRect(0, 0, cw, ch);
      this.videos.forEach((v, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        try {
          if (v.readyState >= 2 && v.videoWidth > 0) {
            this.ctx.drawImage(v, col * tw, row * th, tw, th);
            this.hasDrawnFrame = true;
          }
        } catch {
          /* ignore */
        }
      });
      this.raf = requestAnimationFrame(draw);
    };
    draw();
    this.stream = this.canvas.captureStream(fps);
    for (const t of this.stream.getVideoTracks()) t.enabled = true;
    return this.stream;
  }

  /** @deprecated Prefer startFromVideos — track sinks often stay black. */
  start(tracks: MediaStreamTrack[], fps = 0): MediaStream {
    const temps: HTMLVideoElement[] = [];
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-9999px;width:4px;height:4px;overflow:hidden;opacity:0";
    document.body.appendChild(host);
    for (const track of tracks) {
      if (track.kind !== "video" || track.readyState !== "live") continue;
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.srcObject = new MediaStream([track]);
      host.appendChild(v);
      void v.play().catch(() => undefined);
      temps.push(v);
    }
    if (!temps.length) throw new Error("no live video tracks for canvas mixer");
    const stream = this.startFromVideos(temps, fps);
    // Keep host alive for the life of this mixer (cleared in stop)
    (this as unknown as { _host?: HTMLDivElement })._host = host;
    return stream;
  }

  waitForFrame(timeoutMs = 1500): Promise<boolean> {
    if (this.hasDrawnFrame) return Promise.resolve(true);
    // captureStream path: wait until source video has pixels
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (
          this.hasDrawnFrame ||
          this.videos.some((v) => v.readyState >= 2 && v.videoWidth > 0)
        ) {
          this.hasDrawnFrame = true;
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  stop(): void {
    this.stopped = true;
    this.stopCapture();
    const host = (this as unknown as { _host?: HTMLDivElement })._host;
    if (host) {
      host.remove();
      (this as unknown as { _host?: HTMLDivElement })._host = undefined;
    }
    this.videos.length = 0;
  }

  private stopCapture(): void {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.stream) {
      // Only stop tracks we created via canvas — not the preview video's captureStream
      // tracks if they are the same as the element stream... captureStream tracks
      // should be stopped when we release the recorder source.
      for (const t of this.stream.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
      this.stream = null;
    }
    this.stopped = false;
  }
}
