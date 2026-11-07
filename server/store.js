// Persistence backends. Each run is stored as a single JSON document keyed by its code.
//
//   createStore({ databaseUrl })  -> Postgres (production, e.g. Neon)
//   createStore({ dataDir })      -> one JSON file per run (local development)
//
// Both return the same shape: { name, loadAll(), save(run), close() }.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function createStore({ databaseUrl, dataDir }) {
  return databaseUrl ? postgresStore(databaseUrl) : fileStore(dataDir);
}

async function postgresStore(connectionString) {
  const { default: pg } = await import("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false }, max: 3 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id         TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
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
    close: () => pool.end(),
  };
}

function fileStore(dir) {
  mkdirSync(dir, { recursive: true });
  const pathFor = (id) => join(dir, `${id}.json`);

  return {
    name: `files (${dir})`,
    async loadAll() {
      const runs = [];
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".json")) continue;
        try {
          runs.push(JSON.parse(readFileSync(join(dir, file), "utf8")));
        } catch (err) {
          console.error(`Skipping unreadable run file ${file}: ${err.message}`);
        }
      }
      return runs;
    },
    async save(run) {
      writeFileSync(pathFor(run.id), JSON.stringify(run));
    },
    async close() {},
  };
}
