import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
const DATABASE_URL = process.env.DATABASE_URL || "";
const PORT = process.env.PORT || 3000;
const PLAYER_COUNT = 4;
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
const STATUSES = new Set(["alive", "dead", "boxed", "missed", "none"]);

// ---------- persistence ----------
// Two backends: Postgres (DATABASE_URL set, e.g. Neon on Render) or local JSON files.
// Each run is stored as one JSON blob keyed by its code.
const runs = new Map(); // id -> state

function hydrate(s) {
  s.history ??= [];
  s.badges ??= 0;
  runs.set(s.id, s);
}

async function makeStore() {
  if (DATABASE_URL) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
      max: 3,
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    return {
      name: "postgres",
      async loadAll() {
        const { rows } = await pool.query("SELECT data FROM runs");
        return rows.map((r) => r.data);
      },
      async save(run) {
        await pool.query(
          `INSERT INTO runs (id, data, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [run.id, JSON.stringify(run)]
        );
      },
      async close() {
        await pool.end();
      },
    };
  }
  mkdirSync(DATA_DIR, { recursive: true });
  return {
    name: `files (${DATA_DIR})`,
    async loadAll() {
      const out = [];
      for (const f of readdirSync(DATA_DIR)) {
        if (!f.endsWith(".json")) continue;
        try {
          out.push(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")));
        } catch (e) {
          console.error("Failed to load", f, e.message);
        }
      }
      return out;
    },
    async save(run) {
      writeFileSync(join(DATA_DIR, `${run.id}.json`), JSON.stringify(run));
    },
    async close() {},
  };
}

const store = await makeStore();
for (const s of await store.loadAll()) hydrate(s);
console.log(`Storage: ${store.name} (${runs.size} run${runs.size === 1 ? "" : "s"} loaded)`);

const saveTimers = new Map();
const dirty = new Set();
function persist(run) {
  dirty.add(run.id);
  clearTimeout(saveTimers.get(run.id));
  saveTimers.set(run.id, setTimeout(() => flush(run.id), 250));
}
async function flush(id) {
  saveTimers.delete(id);
  const run = runs.get(id);
  if (!run) return;
  try {
    await store.save(run);
    dirty.delete(id);
  } catch (e) {
    console.error("Persist failed", id, e.message);
  }
}
// Render sends SIGTERM before spin-down/redeploy: write anything still pending first.
async function shutdown(signal) {
  console.log(`${signal} received, flushing ${dirty.size} pending save(s)…`);
  for (const t of saveTimers.values()) clearTimeout(t);
  await Promise.all([...dirty].map(flush));
  await store.close();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ---------- helpers ----------
const uid = (n = 6) =>
  randomBytes(n)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, n);

const newRunCode = () => {
  let code;
  do code = uid(6).toUpperCase();
  while (runs.has(code));
  return code;
};

const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v, lo, hi, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};

function createRun({ name, game, players, rules, routes }) {
  const now = Date.now();
  const routeNames = (Array.isArray(routes) ? routes : [])
    .map((r) => str(r, 60))
    .filter(Boolean)
    .slice(0, 400);
  const run = {
    id: newRunCode(),
    name: str(name) || "Our Nuzlocke",
    game: str(game) || "Emerald",
    rules: str(rules, 4000),
    createdAt: now,
    updatedAt: now,
    players: Array.from({ length: PLAYER_COUNT }, (_, i) => ({
      id: `p${i + 1}`,
      name: str(players?.[i]) || `Player ${i + 1}`,
      color: COLORS[i],
      badges: 0,
    })),
    routes: routeNames.map((n) => ({ id: uid(8), name: n })),
    encounters: {}, // routeId -> playerId -> encounter
    history: [], // archived (lost) attempts
    badges: 0, // gym badges earned in the current attempt
    log: [],
  };
  runs.set(run.id, run);
  persist(run);
  return run;
}

function addLog(run, text, playerId = null) {
  run.log.unshift({ id: uid(8), ts: Date.now(), playerId, text });
  if (run.log.length > 300) run.log.length = 300;
}

function sanitizeEncounter(e = {}) {
  return {
    species: str(e.species, 40),
    dexId: int(e.dexId, 0, 100000, 0) || null,
    nickname: str(e.nickname, 24),
    level: int(e.level, 0, 100, 0) || null,
    status: STATUSES.has(e.status) ? e.status : "none",
    notes: str(e.notes, 300),
    updatedAt: Date.now(),
  };
}

// Apply one operation; returns a log message or throws.
function applyOp(run, op, actor) {
  const who = run.players.find((p) => p.id === actor)?.name || "Someone";
  // Per-player data (encounters, name, sprite) may only be changed by that player.
  const ownOnly = (player) => {
    if (!actor) throw new Error("Pick who you are (top right) before editing");
    if (player.id !== actor) throw new Error(`Only ${player.name} can edit that`);
  };
  switch (op.type) {
    case "setEncounter": {
      const route = run.routes.find((r) => r.id === op.routeId);
      const player = run.players.find((p) => p.id === op.playerId);
      if (!route || !player) throw new Error("Unknown route/player");
      ownOnly(player);
      const prev = run.encounters[route.id]?.[player.id];
      const next = sanitizeEncounter(op.encounter);
      if (!next.species && next.status === "none") {
        if (run.encounters[route.id]) delete run.encounters[route.id][player.id];
        if (prev?.species) return `${who} cleared ${player.name}'s ${route.name} encounter`;
        return null;
      }
      run.encounters[route.id] ??= {};
      run.encounters[route.id][player.id] = next;
      const label = next.nickname ? `${next.nickname} (${next.species})` : next.species || "an encounter";
      if (prev?.status !== "dead" && next.status === "dead") return `💀 ${player.name}'s ${label} died on ${route.name}`;
      if (!prev?.species && next.species) return `${player.name} caught ${label} on ${route.name}`;
      if (prev?.status === "dead" && next.status !== "dead") return `${player.name}'s ${label} was revived (status changed)`;
      if (prev?.status !== "missed" && next.status === "missed") return `${player.name} missed the ${route.name} encounter`;
      if (prev?.species !== next.species) return `${player.name}'s ${route.name} encounter changed to ${next.species}`;
      return null;
    }
    case "addRoutes": {
      const names = (Array.isArray(op.names) ? op.names : [op.name])
        .map((n) => str(n, 60))
        .filter(Boolean);
      if (!names.length) throw new Error("No route names");
      if (run.routes.length + names.length > 400) throw new Error("Too many routes");
      if (op.prepend) run.routes.unshift(...names.map((n) => ({ id: uid(8), name: n })));
      else for (const n of names) run.routes.push({ id: uid(8), name: n });
      return names.length === 1 ? `${who} added route "${names[0]}"` : `${who} added ${names.length} routes`;
    }
    case "renameRoute": {
      const route = run.routes.find((r) => r.id === op.routeId);
      if (!route) throw new Error("Unknown route");
      const name = str(op.name, 60);
      if (!name) throw new Error("Empty name");
      route.name = name;
      return null;
    }
    case "removeRoute": {
      const i = run.routes.findIndex((r) => r.id === op.routeId);
      if (i < 0) throw new Error("Unknown route");
      const [r] = run.routes.splice(i, 1);
      delete run.encounters[r.id];
      return `${who} removed route "${r.name}"`;
    }
    case "moveRoute": {
      const i = run.routes.findIndex((r) => r.id === op.routeId);
      if (i < 0) throw new Error("Unknown route");
      const j = Math.max(0, Math.min(run.routes.length - 1, i + (op.delta < 0 ? -1 : 1)));
      const [r] = run.routes.splice(i, 1);
      run.routes.splice(j, 0, r);
      return null;
    }
    case "setRouteWipe": {
      const route = run.routes.find((r) => r.id === op.routeId);
      if (!route) throw new Error("Unknown route");
      const marker = run.players.find((p) => p.id === actor);
      if (!marker) throw new Error("Pick who you are first");
      const row = (run.encounters[route.id] ??= {});
      if (op.wiped) {
        if (route.wipe) return null;
        const prev = {};
        for (const [pid, e] of Object.entries(row)) {
          if (e.species) {
            prev[pid] = e.status;
            e.status = "dead";
            e.updatedAt = Date.now();
          }
        }
        route.wipe = { by: marker.id, byName: marker.name, at: Date.now(), prev };
        return `💀 ${marker.name} marked everyone's ${route.name} Pokémon dead`;
      }
      if (!route.wipe) return null;
      for (const [pid, status] of Object.entries(route.wipe.prev || {})) {
        if (row[pid] && row[pid].status === "dead") row[pid].status = status;
      }
      delete route.wipe;
      return `${marker.name} un-marked the ${route.name} wipe`;
    }
    case "reorderRoute": {
      const i = run.routes.findIndex((r) => r.id === op.routeId);
      if (i < 0) throw new Error("Unknown route");
      const to = int(op.toIndex, 0, run.routes.length - 1, i);
      if (to === i) return null;
      const [r] = run.routes.splice(i, 1);
      run.routes.splice(to, 0, r);
      return null;
    }
    case "setPlayer": {
      const player = run.players.find((p) => p.id === op.playerId);
      if (!player) throw new Error("Unknown player");
      ownOnly(player);
      if (op.name !== undefined) player.name = str(op.name, 24) || player.name;
      if (op.sprite !== undefined) {
        const s = str(op.sprite, 40);
        if (s && !/^[a-z0-9-]+$/.test(s)) throw new Error("Bad sprite");
        player.sprite = s || null;
      }
      if (op.badges !== undefined) {
        const b = int(op.badges, 0, 16, player.badges);
        if (b !== player.badges) {
          player.badges = b;
          return `${player.name} now has ${b} badge${b === 1 ? "" : "s"}`;
        }
      }
      return null;
    }
    case "setBadges": {
      const b = int(op.badges, 0, 8, run.badges || 0);
      if (b === (run.badges || 0)) return null;
      run.badges = b;
      return `${who} set badges to ${b}`;
    }
    case "setMeta": {
      if (op.name !== undefined) run.name = str(op.name) || run.name;
      if (op.game !== undefined) run.game = str(op.game) || run.game;
      if (op.rules !== undefined) run.rules = str(op.rules, 4000);
      return null;
    }
    case "resetRun": {
      const resetter = run.players.find((p) => p.id === actor);
      if (!resetter) throw new Error("Pick who you are before resetting");
      const now = Date.now();
      const attempt = {
        id: uid(8),
        number: run.history.length + 1,
        reason: str(op.reason, 500),
        startedAt: run.history.length ? run.history[run.history.length - 1].endedAt : run.createdAt,
        endedAt: now,
        resetBy: resetter.id,
        resetByName: resetter.name,
        players: run.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
        routes: run.routes.map((r) => ({ id: r.id, name: r.name, wipe: r.wipe || null })),
        encounters: run.encounters,
        badges: run.badges || 0,
      };
      run.history.push(attempt);
      if (run.history.length > 100) run.history.shift();
      run.encounters = {};
      run.badges = 0;
      for (const r of run.routes) delete r.wipe;
      return `🔁 ${resetter.name} reset the run (attempt #${attempt.number} archived)${attempt.reason ? `: ${attempt.reason}` : ""}`;
    }
    case "deleteAttempt": {
      const i = run.history.findIndex((a) => a.id === op.attemptId);
      if (i < 0) throw new Error("Unknown attempt");
      const [a] = run.history.splice(i, 1);
      run.history.forEach((h, idx) => (h.number = idx + 1)); // keep numbering contiguous
      delete run.attemptCount;
      return `${who} deleted archived attempt #${a.number}`;
    }
    case "note": {
      const text = str(op.text, 280);
      if (!text) throw new Error("Empty note");
      return `${who}: ${text}`;
    }
    default:
      throw new Error("Unknown op " + op.type);
  }
}

// ---------- http ----------
const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.static(join(__dirname, "public"), { extensions: ["html"] }));

app.get("/healthz", (_req, res) => res.json({ ok: true, storage: store.name, runs: runs.size }));

app.post("/api/runs", (req, res) => {
  const run = createRun(req.body || {});
  addLog(run, "Run created");
  res.json(run);
});

app.get("/api/runs/:id", (req, res) => {
  const run = runs.get(req.params.id.toUpperCase());
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(run);
});

app.get("/run/:id", (_req, res) => res.sendFile(join(__dirname, "public", "run.html")));

// ---------- websockets ----------
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const rooms = new Map(); // runId -> Set<ws>

function presence(runId) {
  const set = rooms.get(runId);
  if (!set) return [];
  const seen = new Map();
  for (const ws of set) if (ws.actor) seen.set(ws.actor, (seen.get(ws.actor) || 0) + 1);
  return [...seen.keys()];
}

function broadcast(runId, msg, except = null) {
  const data = JSON.stringify(msg);
  for (const ws of rooms.get(runId) || []) {
    if (ws !== except && ws.readyState === ws.OPEN) ws.send(data);
  }
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      const run = runs.get(String(msg.runId || "").toUpperCase());
      if (!run) return ws.send(JSON.stringify({ type: "error", error: "Run not found" }));
      if (ws.runId) rooms.get(ws.runId)?.delete(ws);
      ws.runId = run.id;
      ws.actor = run.players.some((p) => p.id === msg.actor) ? msg.actor : null;
      if (!rooms.has(run.id)) rooms.set(run.id, new Set());
      rooms.get(run.id).add(ws);
      ws.send(JSON.stringify({ type: "state", run }));
      broadcast(run.id, { type: "presence", online: presence(run.id) });
      return;
    }

    if (msg.type === "identify") {
      const run = runs.get(ws.runId);
      if (!run) return;
      ws.actor = run.players.some((p) => p.id === msg.actor) ? msg.actor : null;
      broadcast(run.id, { type: "presence", online: presence(run.id) });
      return;
    }

    if (msg.type === "op") {
      const run = runs.get(ws.runId);
      if (!run) return;
      try {
        const text = applyOp(run, msg.op || {}, ws.actor);
        run.updatedAt = Date.now();
        if (text) addLog(run, text, ws.actor);
        persist(run);
        broadcast(run.id, { type: "state", run, opId: msg.opId, from: ws.actor });
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", error: e.message, opId: msg.opId }));
      }
    }
  });

  ws.on("close", () => {
    if (!ws.runId) return;
    const set = rooms.get(ws.runId);
    set?.delete(ws);
    if (set && set.size === 0) rooms.delete(ws.runId);
    else broadcast(ws.runId, { type: "presence", online: presence(ws.runId) });
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Nuzlocke tracker running on http://localhost:${PORT}`));
