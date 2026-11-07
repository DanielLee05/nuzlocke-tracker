// Entry point: HTTP (static files + run creation) and WebSockets (live sync).
//
// Environment:
//   PORT          HTTP port (default 3000)
//   DATABASE_URL  Postgres connection string; when unset, runs are saved as JSON files in DATA_DIR
//   DATA_DIR      directory for the file store (default ./data)

import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { attachRealtime } from "./server/realtime.js";
import { RunRepository } from "./server/repository.js";
import { createStore } from "./server/store.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = process.env.PORT || 3000;

const store = await createStore({
  databaseUrl: process.env.DATABASE_URL,
  dataDir: process.env.DATA_DIR || join(ROOT, "data"),
});
const repo = new RunRepository(store);
const loaded = await repo.load();
console.log(`Storage: ${store.name} (${loaded} run${loaded === 1 ? "" : "s"} loaded)`);

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.get("/healthz", (_req, res) => res.json({ ok: true, storage: store.name, runs: repo.size }));
app.post("/api/runs", (req, res) => res.json(repo.create(req.body ?? {})));
app.get("/run/:id", (_req, res) => res.sendFile(join(PUBLIC_DIR, "run.html")));

const httpServer = createServer(app);
attachRealtime(httpServer, repo);
httpServer.listen(PORT, () => console.log(`Nuzlocke tracker running on http://localhost:${PORT}`));

// Hosts send SIGTERM before spin-down/redeploy: write anything still pending first.
async function shutdown(signal) {
  console.log(`${signal} received, flushing ${repo.pendingSaves} pending save(s)…`);
  httpServer.close();
  await repo.flushAll();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
