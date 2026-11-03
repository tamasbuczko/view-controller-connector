/** Local copy of @vcc/core parsePairUri — avoids bare @vcc/core import in browser ESM. */

export type PairUriPayload = {
  v: 1;
  sessionId: string;
  target:
    | { type: "view"; viewId: string }
    | { type: "group"; groupId: string };
  pairToken: string;
  signalingUrl: string;
  mode: string;
  uri: string;
};

export function parsePairUri(uri: string): PairUriPayload | null {
  try {
    const u = new URL(uri.replace(/^vcc:/i, "https:"));
    const sessionId = u.searchParams.get("s");
    const targetRaw = u.searchParams.get("target");
    const pairToken = u.searchParams.get("t");
    const signalingUrl = u.searchParams.get("sig");
    const mode = u.searchParams.get("mode");
    if (!sessionId || !targetRaw || !pairToken || !signalingUrl || !mode) {
      return null;
    }
    let target: PairUriPayload["target"];
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
