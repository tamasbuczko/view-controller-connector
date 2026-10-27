import type { ConflictStrategy, Role } from "./types.js";
import { VccClientError } from "./errors.js";

/** Who may call kick() for a given disconnectPolicy. */
export function canKick(
  policy: "observer-only" | "observer+view" | "observer+view+self-leave",
  role: Role | null,
): boolean {
  if (role === "observer") return true;
  if (
    role === "view" &&
    (policy === "observer+view" || policy === "observer+view+self-leave")
  ) {
    return true;
  }
  return false;
}

export function canSelfLeave(
  policy: "observer-only" | "observer+view" | "observer+view+self-leave",
): boolean {
  return policy === "observer+view+self-leave" || policy === "observer+view" || policy === "observer-only";
  // leave() is always allowed for self; policy mainly gates kick. Controllers always leave.
}

export class ConflictBoard {
  private locks = new Map<string, string>(); // feature → peerId
  private mediaHolders = new Map<string, string>(); // feature → peerId

  tryClaim(
    feature: string,
    strategy: ConflictStrategy,
    peerId: string,
  ): { ok: true } | { ok: false; winnerPeerId: string } {
    if (strategy === "last-write-wins") {
      this.locks.set(feature, peerId);
      return { ok: true };
    }
    if (strategy === "active-lock") {
      const holder = this.locks.get(feature);
      if (holder && holder !== peerId) {
        return { ok: false, winnerPeerId: holder };
      }
      this.locks.set(feature, peerId);
      return { ok: true };
    }
    // media-exclusive
    const holder = this.mediaHolders.get(feature);
    if (holder && holder !== peerId) {
      return { ok: false, winnerPeerId: holder };
    }
    this.mediaHolders.set(feature, peerId);
    return { ok: true };
  }

  noteRemote(
    feature: string,
    strategy: ConflictStrategy,
    peerId: string,
  ): void {
    if (strategy === "last-write-wins" || strategy === "active-lock") {
      this.locks.set(feature, peerId);
    }
    if (strategy === "media-exclusive") {
      this.mediaHolders.set(feature, peerId);
    }
  }

  release(feature: string, peerId: string, strategy: ConflictStrategy): void {
    if (strategy === "active-lock" && this.locks.get(feature) === peerId) {
      this.locks.delete(feature);
    }
    if (
      strategy === "media-exclusive" &&
      this.mediaHolders.get(feature) === peerId
    ) {
      this.mediaHolders.delete(feature);
    }
  }

  releaseAllForPeer(peerId: string): void {
    for (const [k, v] of [...this.locks.entries()]) {
      if (v === peerId) this.locks.delete(k);
    }
    for (const [k, v] of [...this.mediaHolders.entries()]) {
      if (v === peerId) this.mediaHolders.delete(k);
    }
  }
}

export function denyUnlessKickAllowed(
  policy: "observer-only" | "observer+view" | "observer+view+self-leave",
  role: Role | null,
): void {
  if (!canKick(policy, role)) {
    throw new VccClientError(
      "POLICY_DENIED",
      `kick not allowed by disconnectPolicy=${policy} for role=${role}`,
    );
  }
}
