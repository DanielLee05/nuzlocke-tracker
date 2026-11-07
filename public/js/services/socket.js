// WebSocket connection to the server with automatic reconnect.
//
//   connect({ onState, onPresence, onNotFound, onError, onStatus })
//   send(op)         apply an operation (see server/ops.js)
//   identify(actor)  tell the server who this browser is acting as

import { toast } from "../lib/dom.js";
import { runId, state } from "../models/state.js";

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 8000;

let socket = null;
let retryDelay = INITIAL_RETRY_MS;

export function connect(handlers) {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws`);
  handlers.onStatus("connecting…", "");

  socket.onopen = () => {
    retryDelay = INITIAL_RETRY_MS;
    handlers.onStatus("live", "ok");
    transmit({ type: "join", runId, actor: state.actor });
  };

  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    switch (msg.type) {
      case "state":
        return handlers.onState(msg.run, msg.from);
      case "presence":
        return handlers.onPresence(msg.online);
      case "error":
        if (msg.error === "Run not found") {
          socket.onclose = null; // don't reconnect to a run that doesn't exist
          socket.close();
          return handlers.onNotFound();
        }
        return handlers.onError(msg.error);
    }
  };

  socket.onclose = () => {
    handlers.onStatus("reconnecting…", "bad");
    setTimeout(() => connect(handlers), retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
  };
}

export function send(op) {
  if (socket?.readyState !== WebSocket.OPEN) return toast("Not connected – change not sent", { error: true });
  transmit({ type: "op", op, opId: Math.random().toString(36).slice(2) });
}

export function identify(actor) {
  if (socket?.readyState === WebSocket.OPEN) transmit({ type: "identify", actor });
}

const transmit = (msg) => socket.send(JSON.stringify(msg));
