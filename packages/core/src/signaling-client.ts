import { VccClientError } from "./errors.js";

export type SignalHandler = (msg: Record<string, unknown>) => void;

/**
 * Browser WebSocket client for VCC signaling.
 * Production: wss:// — local demó: ws:// allowed.
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly onMessage: SignalHandler;
  private readonly onClose: (reason: string) => void;
  private opened = false;

  constructor(
    url: string,
    onMessage: SignalHandler,
    onClose: (reason: string) => void,
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onClose = onClose;
  }

  async connect(): Promise<void> {
    if (this.ws && this.opened) return;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      const timer = setTimeout(() => {
        ws.close();
        reject(
          new VccClientError("SIGNALING_DISCONNECT", "signaling connect timeout", {
            retryable: true,
          }),
        );
      }, 10_000);

      ws.onopen = () => {
        clearTimeout(timer);
        this.opened = true;
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timer);
        reject(
          new VccClientError("SIGNALING_DISCONNECT", "signaling connection failed", {
            retryable: true,
          }),
        );
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as Record<string, unknown>;
          this.onMessage(data);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        this.opened = false;
        this.ws = null;
        this.onClose("closed");
      };
    });
  }

  send(msg: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new VccClientError(
        "SIGNALING_DISCONNECT",
        "signaling socket not open",
        { retryable: true },
      );
    }
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.opened = false;
  }
}
