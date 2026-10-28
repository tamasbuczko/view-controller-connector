import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { summarizeMsg } from "./log.js";
import { RateLimiter } from "./rate-limit.js";
import { Store, type ConnectionMode, type Peer, type Role } from "./store.js";

const PORT = Number(process.env.VCC_SIGNALING_PORT ?? 8787);
const HOST = process.env.VCC_SIGNALING_HOST ?? "127.0.0.1";
const VCC_ENV = process.env.VCC_ENV ?? "development";
/** Comma-separated; empty = allow all (local demó only). */
const ALLOWED_ORIGINS = (process.env.VCC_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isLocalHost =
  HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";
if (VCC_ENV === "production" && ALLOWED_ORIGINS.length === 0) {
  console.error(
    "[security] VCC_ENV=production requires VCC_ALLOWED_ORIGINS — refusing to start",
  );
  process.exit(1);
}
if (!isLocalHost && ALLOWED_ORIGINS.length === 0) {
  console.error(
    "[security] non-local bind requires VCC_ALLOWED_ORIGINS — refusing to start",
  );
  process.exit(1);
}

const store = new Store();
/** Per-peer message rate (ICE bursts allowed via higher ceiling). */
const rateLimit = new RateLimiter(120, 10_000);
const MAX_FRAME = 256_000;

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastTopology(sessionId: string): void {
  const topology = store.topology(sessionId);
  if (!topology) return;
  for (const p of store.peersInSession(sessionId)) {
    send(p.ws, { type: "topology", topology });
  }
}

function broadcastPairingClosed(
  sessionId: string,
  target: { type: string; viewId?: string; groupId?: string },
): void {
  for (const p of store.peersInSession(sessionId)) {
    send(p.ws, {
      type: "pairing.closed",
      target,
      reason: "consumed",
    });
  }
}

function reply(
  ws: WebSocket,
  reqId: unknown,
  msg: Record<string, unknown>,
): void {
  send(ws, reqId ? { ...msg, reqId } : msg);
}

function fail(
  ws: WebSocket,
  reqId: unknown,
  code: string,
  message: string,
): void {
  reply(ws, reqId, { type: "error", code, message });
}

function originOk(origin: string | undefined): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true; // local demó
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("VCC signaling OK\n");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (!originOk(typeof origin === "string" ? origin : undefined)) {
    ws.close(1008, "origin denied");
    return;
  }

  const peer = store.addPeer(ws);
  send(ws, { type: "welcome", peerId: peer.id, protocol: 1 });

  ws.on("message", (raw) => {
    const bytes = typeof raw === "string" ? raw.length : Buffer.byteLength(raw as Buffer);
    if (bytes > MAX_FRAME) {
      ws.close(1009, "frame too large");
      return;
    }
    if (!rateLimit.allow(peer.id)) {
      fail(ws, undefined, "POLICY_DENIED", "rate limit exceeded");
      ws.close(1008, "rate limit");
      return;
    }
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      return;
    }
    if (VCC_ENV !== "production") {
      console.log(`[sig] ${peer.id.slice(0, 8)} ${summarizeMsg(msg)}`);
    } else if (msg.type === "session.join" || msg.type === "pairing.mint") {
      console.log(`[sig] ${peer.id.slice(0, 8)} ${summarizeMsg(msg)}`);
    }
    void handle(peer, ws, msg);
  });

  ws.on("close", () => {
    rateLimit.clear(peer.id);
    const sid = peer.sessionId;
    store.removePeer(peer.id);
    if (sid) {
      for (const p of store.peersInSession(sid)) {
        send(p.ws, { type: "peer.left", peerId: peer.id });
      }
      broadcastTopology(sid);
    }
  });
});

async function handle(
  peer: Peer,
  ws: WebSocket,
  msg: Record<string, unknown>,
): Promise<void> {
  const type = String(msg.type ?? "");
  const reqId = msg.reqId;

  switch (type) {
    case "hello":
      return;

    case "session.create": {
      const mode = String(msg.mode ?? "1-1") as ConnectionMode;
      const room = store.createSession(mode, peer);
      reply(ws, reqId, {
        type: "session.created",
        sessionId: room.id,
        sessionCode: room.code,
        mode: room.mode,
      });
      broadcastTopology(room.id);
      return;
    }

    case "session.setMode": {
      const room = store.sessions.get(String(msg.sessionId));
      if (!room || peer.sessionId !== room.id || peer.role !== "observer") {
        return fail(ws, reqId, "POLICY_DENIED", "only observer can set mode");
      }
      room.mode = String(msg.mode) as ConnectionMode;
      reply(ws, reqId, { type: "session.modeSet", mode: room.mode });
      broadcastTopology(room.id);
      return;
    }

    case "group.define": {
      const room = store.sessions.get(String(msg.sessionId));
      if (!room || peer.role !== "observer") {
        return fail(ws, reqId, "POLICY_DENIED", "only observer can define groups");
      }
      const groupId = String(msg.groupId);
      const memberIds = (msg.memberIds as string[]) ?? [];
      room.groups.set(groupId, memberIds);
      reply(ws, reqId, { type: "group.defined", groupId });
      broadcastTopology(room.id);
      return;
    }

    case "session.deactivate": {
      const room = store.sessions.get(String(msg.sessionId));
      if (!room || peer.role !== "observer") {
        return fail(ws, reqId, "POLICY_DENIED", "only observer can deactivate");
      }
      room.active = false;
      reply(ws, reqId, { type: "session.deactivated" });
      return;
    }

    case "session.join": {
      let room = msg.code
        ? store.findByCode(String(msg.code))
        : undefined;
      let target = msg.target as
        | { type: string; viewId?: string; groupId?: string }
        | undefined;
      let closedPairing = false;

      if (msg.pairToken) {
        const found = store.findPairToken(String(msg.pairToken));
        if (!found) {
          return fail(ws, reqId, "TOKEN_INVALID", "unknown pair token");
        }
        const consumed = store.consumePairToken(
          found.room,
          String(msg.pairToken),
        );
        if (!consumed.ok) {
          return fail(
            ws,
            reqId,
            consumed.code,
            consumed.code === "TOKEN_CONSUMED"
              ? "pair token already used"
              : "invalid pair token",
          );
        }
        room = found.room;
        target = consumed.entry.target;
        closedPairing = consumed.closedPairing;
      }

      if (!room || !room.active) {
        return fail(ws, reqId, "SESSION_NOT_FOUND", "session not found");
      }

      const role = String(msg.role ?? "view") as Role;
      if (role !== "view" && role !== "controller") {
        return fail(ws, reqId, "CONFIG_INVALID", "invalid role");
      }

      peer.role = role;
      peer.sessionId = room.id;

      if (role === "controller" && target) {
        peer.openMesh = false;
        linkController(room, peer, target);
      } else if (role === "controller" && !msg.pairToken) {
        // Code-join convenience: link to every current View; stay open for late Views.
        peer.openMesh = true;
        const views = store
          .peersInSession(room.id)
          .filter((p) => p.role === "view" && p.id !== peer.id);
        for (const v of views) {
          linkController(room, peer, { type: "view", viewId: v.id });
        }
      } else if (role === "view") {
        for (const c of store.peersInSession(room.id)) {
          if (c.role === "controller" && c.openMesh) {
            linkController(room, c, { type: "view", viewId: peer.id });
          }
        }
      }

      for (const p of store.peersInSession(room.id)) {
        if (p.id !== peer.id) {
          send(p.ws, { type: "peer.joined", peerId: peer.id, role });
        }
      }

      reply(ws, reqId, {
        type: "session.joined",
        sessionId: room.id,
        role,
        mode: room.mode,
        topology: store.topology(room.id),
      });
      broadcastTopology(room.id);
      if (closedPairing && target) {
        broadcastPairingClosed(room.id, target);
      }
      return;
    }

    case "session.pair": {
      const room = store.sessions.get(String(msg.sessionId));
      if (!room || peer.role !== "controller") {
        return fail(ws, reqId, "POLICY_DENIED", "controller pair only");
      }
      const consumed = store.consumePairToken(room, String(msg.pairToken));
      if (!consumed.ok) {
        return fail(
          ws,
          reqId,
          consumed.code,
          consumed.code === "TOKEN_CONSUMED"
            ? "pair token already used"
            : "invalid pair token",
        );
      }
      linkController(room, peer, consumed.entry.target);
      reply(ws, reqId, { type: "session.paired" });
      broadcastTopology(room.id);
      if (consumed.closedPairing) {
        broadcastPairingClosed(room.id, consumed.entry.target);
      }
      return;
    }

    case "pairing.mint": {
      const room = store.sessions.get(String(msg.sessionId));
      if (!room) {
        return fail(ws, reqId, "SESSION_NOT_FOUND", "no session");
      }
      if (peer.role !== "observer" && peer.role !== "view") {
        return fail(ws, reqId, "POLICY_DENIED", "cannot mint pairing");
      }
      const target = msg.target as {
        type: string;
        viewId?: string;
        groupId?: string;
      };
      const pairToken = store.mintPairToken(room, target);
      const signalingUrl = `ws://${HOST}:${PORT}`;
      const targetKey =
        target.type === "group"
          ? `group:${target.groupId}`
          : `view:${target.viewId ?? peer.id}`;
      const uri = `vcc://pair?s=${encodeURIComponent(room.id)}&target=${encodeURIComponent(targetKey)}&t=${encodeURIComponent(pairToken)}&sig=${encodeURIComponent(signalingUrl)}&mode=${room.mode}`;
      const payload = {
        v: 1 as const,
        sessionId: room.id,
        target:
          target.type === "group"
            ? { type: "group" as const, groupId: String(target.groupId) }
            : {
                type: "view" as const,
                viewId: String(target.viewId ?? peer.id),
              },
        pairToken,
        signalingUrl,
        mode: room.mode,
        uri,
      };
      reply(ws, reqId, { type: "pairing.token", payload });
      return;
    }

    case "data.relay": {
      // Temporary bootstrap until DataChannel — relay JSON to targets in session.
      const room = store.sessions.get(String(msg.sessionId));
      if (!room || peer.sessionId !== room.id) {
        return fail(ws, reqId, "SESSION_NOT_FOUND", "not in session");
      }
      const envelope = {
        type: "data",
        v: 1,
        id: `m_${Date.now()}`,
        name: msg.name,
        msgType: msg.type,
        ts: Date.now(),
        from: peer.id,
        to: msg.to,
        payload: msg.payload,
        delivery: msg.delivery ?? "reliable",
      };
      const to = msg.to;
      for (const p of store.peersInSession(room.id)) {
        if (p.id === peer.id) continue;
        if (to === "*" || to == null) {
          send(p.ws, envelope);
          continue;
        }
        if (typeof to === "string" && to === p.id) send(p.ws, envelope);
        if (Array.isArray(to) && to.includes(p.id)) send(p.ws, envelope);
      }
      reply(ws, reqId, { type: "data.sent" });
      return;
    }

    case "peer.leave": {
      const sid = peer.sessionId;
      peer.sessionId = null;
      reply(ws, reqId, { type: "peer.left.self" });
      if (sid) {
        for (const p of store.peersInSession(sid)) {
          send(p.ws, { type: "peer.left", peerId: peer.id });
        }
        broadcastTopology(sid);
      }
      return;
    }

    case "peer.kick": {
      if (peer.role !== "observer" && peer.role !== "view") {
        return fail(ws, reqId, "POLICY_DENIED", "cannot kick");
      }
      const target = store.peers.get(String(msg.peerId));
      if (!target || target.sessionId !== peer.sessionId) {
        return fail(ws, reqId, "SESSION_NOT_FOUND", "peer not in session");
      }
      send(target.ws, {
        type: "peer.left",
        peerId: target.id,
        reason: msg.reason ?? "kicked",
      });
      target.ws.close(4000, "kicked");
      reply(ws, reqId, { type: "peer.kicked", peerId: target.id });
      return;
    }

    case "signal.relay": {
      const dest = store.peers.get(String(msg.toPeerId));
      if (!dest) {
        return fail(ws, reqId, "SESSION_NOT_FOUND", "peer missing");
      }
      send(dest.ws, {
        type: "signal.relay",
        fromPeerId: peer.id,
        payload: msg.payload,
      });
      reply(ws, reqId, { type: "signal.relayed" });
      return;
    }

    case "conflict.claim":
    case "conflict.release": {
      const sid = peer.sessionId;
      if (!sid) {
        return fail(ws, reqId, "SESSION_NOT_FOUND", "not in session");
      }
      for (const p of store.peersInSession(sid)) {
        if (p.id === peer.id) continue;
        send(p.ws, {
          type: msg.type,
          fromPeerId: peer.id,
          feature: msg.feature,
          strategy: msg.strategy,
          peerId: msg.peerId ?? peer.id,
        });
      }
      reply(ws, reqId, { type: `${String(msg.type)}.ok` });
      return;
    }

    default:
      fail(ws, reqId, "CONFIG_INVALID", `unknown type: ${type}`);
  }
}

function linkController(
  room: ReturnType<Store["createSession"]>,
  controller: Peer,
  target: { type: string; viewId?: string; groupId?: string },
): void {
  const viewIds: string[] = [];
  if (target.type === "view" && target.viewId) {
    viewIds.push(target.viewId);
  } else if (target.type === "group" && target.groupId) {
    viewIds.push(...(room.groups.get(target.groupId) ?? []));
  }
  for (const viewId of viewIds) {
    if (
      !room.links.some(
        (l) => l.controllerId === controller.id && l.viewId === viewId,
      )
    ) {
      room.links.push({
        controllerId: controller.id,
        viewId,
        state: "connected",
      });
    }
  }
}

httpServer.listen(PORT, HOST, () => {
  console.log(`VCC signaling listening on ws://${HOST}:${PORT}`);
  if (ALLOWED_ORIGINS.length === 0) {
    console.warn(
      "[security] VCC_ALLOWED_ORIGINS empty — all origins allowed (local demó only)",
    );
  }
});
