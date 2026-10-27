import type { VccError, VccErrorCode } from "./types.js";

export class VccClientError extends Error implements VccError {
  readonly code: VccErrorCode;
  readonly retryable?: boolean;
  readonly cause?: unknown;

  constructor(
    code: VccErrorCode,
    message: string,
    opts?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = "VccClientError";
    this.code = code;
    this.retryable = opts?.retryable;
    this.cause = opts?.cause;
  }

  toJSON(): VccError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export function toVccError(err: unknown): VccError {
  if (err instanceof VccClientError) return err.toJSON();
  if (err instanceof Error) {
    return { code: "INTERNAL", message: err.message, cause: err };
  }
  return { code: "INTERNAL", message: String(err) };
}
