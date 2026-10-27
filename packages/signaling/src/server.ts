import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Store, type ConnectionMode, type Peer, type Role } from "./store.js";

const PORT = Number(process.env.VCC_SIGNALING_PORT ?? 8787);
const HOST = process.env.VCC_SIGNALING_HOST ?? "127.0.0.1";
/** Comma-separated; empty = allow all (local demó only). */
const ALLOWED_ORIGINS = (process.env.VCC_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const store = new Store();

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
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      return;
    }
    void handle(peer, ws, msg);
  });

  ws.on("close", () => {
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

      if (msg.pairToken) {
        // find room by scanning tokens (small store)
        for (const r of store.sessions.values()) {
          const entry = r.pairTokens.get(String(msg.pairToken));
          if (entry && !entry.consumed && entry.expiresAt >= Date.now()) {
            room = r;
            target = entry.target;
            store.consumePairToken(r, String(msg.pairToken));
            break;
          }
        }
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
        linkController(room, peer, target);
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
      return;
    }

    case "session.pair": {
      const room = store.sessions.get(String(msg.sessionId));
      if (!room || peer.role !== "controller") {
        return fail(ws, reqId, "POLICY_DENIED", "controller pair only");
      }
      const entry = store.consumePairToken(room, String(msg.pairToken));
      if (!entry) {
        return fail(ws, reqId, "TOKEN_INVALID", "invalid or consumed token");
      }
      linkController(room, peer, entry.target);
      reply(ws, reqId, { type: "session.paired" });
      broadcastTopology(room.id);
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
