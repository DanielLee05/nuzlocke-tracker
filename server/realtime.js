// WebSocket layer. One "room" per run; every change is broadcast as the full run document.
//
// Client -> server messages:
//   { type: "join", runId, actor }          subscribe to a run, identify as a player (or null)
//   { type: "identify", actor }             change who you are
//   { type: "op", op, opId }                apply an operation (see ops.js)
//
// Server -> client messages:
//   { type: "state", run, opId?, from? }    current document (after join, and after every op)
//   { type: "presence", online: [ids] }     which players currently have a tab open
//   { type: "error", error, opId? }

import { WebSocketServer } from "ws";
import { applyOp } from "./ops.js";

const HEARTBEAT_MS = 30_000;

export function attachRealtime(httpServer, repo) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const rooms = new Map(); // runId -> Set<ws>

  const sendTo = (ws, msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));
  const broadcast = (runId, msg) => {
    for (const ws of rooms.get(runId) ?? []) sendTo(ws, msg);
  };
  const onlinePlayers = (runId) => [...new Set([...(rooms.get(runId) ?? [])].map((ws) => ws.actor).filter(Boolean))];
  const announcePresence = (runId) => broadcast(runId, { type: "presence", online: onlinePlayers(runId) });

  const leaveRoom = (ws) => {
    const room = rooms.get(ws.runId);
    if (!room) return;
    room.delete(ws);
    if (room.size === 0) rooms.delete(ws.runId);
    else announcePresence(ws.runId);
  };

  const handlers = {
    join(ws, msg) {
      const run = repo.get(msg.runId);
      if (!run) return sendTo(ws, { type: "error", error: "Run not found" });
      leaveRoom(ws);
      ws.runId = run.id;
      ws.actor = validActor(run, msg.actor);
      if (!rooms.has(run.id)) rooms.set(run.id, new Set());
      rooms.get(run.id).add(ws);
      sendTo(ws, { type: "state", run });
      announcePresence(run.id);
    },

    identify(ws, msg) {
      const run = repo.get(ws.runId);
      if (!run) return;
      ws.actor = validActor(run, msg.actor);
      announcePresence(run.id);
    },

    op(ws, msg) {
      const run = repo.get(ws.runId);
      if (!run) return;
      try {
        applyOp(run, msg.op ?? {}, ws.actor);
        repo.markChanged(run);
        broadcast(run.id, { type: "state", run, opId: msg.opId, from: ws.actor });
      } catch (err) {
        sendTo(ws, { type: "error", error: err.message, opId: msg.opId });
      }
    },
  };

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
    ws.on("close", () => leaveRoom(ws));
    ws.on("message", (raw) => {
      const msg = parse(raw);
      handlers[msg?.type]?.(ws, msg);
    });
  });

  // Drop connections that stopped answering pings (closed laptops, dead networks).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

const validActor = (run, actor) => (run.players.some((p) => p.id === actor) ? actor : null);

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
