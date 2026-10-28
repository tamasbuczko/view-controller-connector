/** Mask secrets in log lines. */
export function maskSecret(value: string, keep = 4): string {
  if (!value) return "";
  if (value.length <= keep * 2) return "***";
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

export function summarizeMsg(msg: Record<string, unknown>): string {
  const type = String(msg.type ?? "?");
  const parts = [`type=${type}`];
  if (msg.pairToken) {
    parts.push(`pairToken=${maskSecret(String(msg.pairToken))}`);
  }
  if (msg.code) parts.push(`code=${maskSecret(String(msg.code), 2)}`);
  if (msg.sessionId) parts.push(`sessionId=${String(msg.sessionId).slice(0, 8)}…`);
  return parts.join(" ");
}
