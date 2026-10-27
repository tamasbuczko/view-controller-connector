import type { ConnectionMode, PairPayload, PairingTarget } from "./types.js";

/** 1-1 / 1-n: QR must hide after first successful pair. */
export function shouldHideQrAfterPair(mode: ConnectionMode): boolean {
  return mode === "1-1" || mode === "1-n";
}

/** n-1 / n-n: QR may stay and support hide/show. */
export function allowsPersistentQr(mode: ConnectionMode): boolean {
  return mode === "n-1" || mode === "n-n";
}

/** Parse deep link / QR URI into PairPayload fields (best-effort). */
export function parsePairUri(uri: string): PairPayload | null {
  try {
    const u = new URL(uri.replace(/^vcc:/i, "https:"));
    const sessionId = u.searchParams.get("s");
    const targetRaw = u.searchParams.get("target");
    const pairToken = u.searchParams.get("t");
    const signalingUrl = u.searchParams.get("sig");
    const mode = u.searchParams.get("mode") as ConnectionMode | null;
    if (!sessionId || !targetRaw || !pairToken || !signalingUrl || !mode) {
      return null;
    }
    let target: PairingTarget;
    if (targetRaw.startsWith("group:")) {
      target = { type: "group", groupId: targetRaw.slice("group:".length) };
    } else if (targetRaw.startsWith("view:")) {
      target = { type: "view", viewId: targetRaw.slice("view:".length) };
    } else {
      return null;
    }
    return {
      v: 1,
      sessionId,
      target,
      pairToken,
      signalingUrl,
      mode,
      uri,
    };
  } catch {
    return null;
  }
}
