import type { WebSocket } from "ws";
import { peerId, sessionCode, sessionId, token } from "./crypto-util.js";

export type Role = "observer" | "view" | "controller";
export type ConnectionMode = "1-1" | "1-n" | "n-1" | "n-n";

export interface Peer {
  id: string;
  role: Role;
  ws: WebSocket;
  sessionId: string | null;
  label?: string;
}

export interface Link {
  controllerId: string;
  viewId: string;
  state: "pairing" | "connected" | "failed";
}

export type PairTarget = {
  type: string;
  viewId?: string;
  groupId?: string;
};

export interface PairTokenEntry {
  target: PairTarget;
  expiresAt: number;
  consumed: boolean;
  singleUse: boolean;
}

export interface SessionRoom {
  id: string;
  code: string;
  mode: ConnectionMode;
  active: boolean;
  groups: Map<string, string[]>;
  links: Link[];
  pairTokens: Map<string, PairTokenEntry>;
}

export function isSingleUseMode(mode: ConnectionMode): boolean {
  return mode === "1-1" || mode === "1-n";
}

export class Store {
  peers = new Map<string, Peer>();
  sessions = new Map<string, SessionRoom>();
  codeIndex = new Map<string, string>();

  addPeer(ws: WebSocket): Peer {
    const p: Peer = { id: peerId(), role: "observer", ws, sessionId: null };
    this.peers.set(p.id, p);
    return p;
  }

  removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (peer.sessionId) {
      const room = this.sessions.get(peer.sessionId);
      if (room) {
        room.links = room.links.filter(
          (l) => l.controllerId !== id && l.viewId !== id,
        );
      }
    }
    this.peers.delete(id);
  }

  createSession(mode: ConnectionMode, observer: Peer): SessionRoom {
    let code = sessionCode();
    while (this.codeIndex.has(code)) code = sessionCode();
    const room: SessionRoom = {
      id: sessionId(),
      code,
      mode,
      active: true,
      groups: new Map(),
      links: [],
      pairTokens: new Map(),
    };
    this.sessions.set(room.id, room);
    this.codeIndex.set(code, room.id);
    observer.role = "observer";
    observer.sessionId = room.id;
    return room;
  }

  findByCode(code: string): SessionRoom | undefined {
    const id = this.codeIndex.get(code.toUpperCase());
    return id ? this.sessions.get(id) : undefined;
  }

  peersInSession(sessionId: string): Peer[] {
    return [...this.peers.values()].filter((p) => p.sessionId === sessionId);
  }

  topology(sessionId: string) {
    const room = this.sessions.get(sessionId);
    if (!room) return null;
    const peers = this.peersInSession(sessionId).map((p) => ({
      id: p.id,
      role: p.role,
      label: p.label,
      groups: [...room.groups.entries()]
        .filter(([, members]) => members.includes(p.id))
        .map(([gid]) => gid),
    }));
    return {
      sessionId,
      mode: room.mode,
      peers,
      groups: [...room.groups.entries()].map(([id, members]) => ({
        id,
        members,
      })),
      links: [...room.links],
    };
  }

  mintPairToken(room: SessionRoom, target: PairTarget): string {
    const t = token();
    room.pairTokens.set(t, {
      target,
      expiresAt: Date.now() + 15 * 60_000,
      consumed: false,
      singleUse: isSingleUseMode(room.mode),
    });
    return t;
  }

  findPairToken(
    pairToken: string,
  ): { room: SessionRoom; entry: PairTokenEntry } | null {
    for (const room of this.sessions.values()) {
      const entry = room.pairTokens.get(pairToken);
      if (entry) return { room, entry };
    }
    return null;
  }

  /**
   * Consume a pair token according to ConnectionMode.
   * 1-1 / 1-n: single-use → second call TOKEN_CONSUMED
   * n-1 / n-n: reusable until expiry
   */
  consumePairToken(
    room: SessionRoom,
    pairToken: string,
  ):
    | { ok: true; entry: PairTokenEntry; closedPairing: boolean }
    | { ok: false; code: "TOKEN_INVALID" | "TOKEN_CONSUMED" } {
    const entry = room.pairTokens.get(pairToken);
    if (!entry) return { ok: false, code: "TOKEN_INVALID" };
    if (entry.expiresAt < Date.now()) {
      room.pairTokens.delete(pairToken);
      return { ok: false, code: "TOKEN_INVALID" };
    }
    if (entry.singleUse && entry.consumed) {
      return { ok: false, code: "TOKEN_CONSUMED" };
    }
    const closedPairing = entry.singleUse && !entry.consumed;
    entry.consumed = true;
    return { ok: true, entry, closedPairing };
  }
}
