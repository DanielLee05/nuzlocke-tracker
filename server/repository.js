// In-memory registry of runs backed by a store. All reads are served from memory; writes are
// debounced per run so a burst of edits becomes a single save.

import { createRun, migrate } from "./run.js";

const SAVE_DEBOUNCE_MS = 250;

export class RunRepository {
  #store;
  #runs = new Map(); // id -> run
  #timers = new Map(); // id -> pending save timer
  #dirty = new Set(); // ids changed since their last successful save

  constructor(store) {
    this.#store = store;
  }

  async load() {
    for (const doc of await this.#store.loadAll()) {
      const run = migrate(doc);
      this.#runs.set(run.id, run);
    }
    return this.#runs.size;
  }

  get size() {
    return this.#runs.size;
  }

  get(id) {
    return this.#runs.get(String(id ?? "").toUpperCase()) ?? null;
  }

  create(input) {
    const run = createRun(input, (id) => this.#runs.has(id));
    this.#runs.set(run.id, run);
    this.markChanged(run);
    return run;
  }

  /** Schedule a save for `run`. Safe to call on every edit. */
  markChanged(run) {
    this.#dirty.add(run.id);
    clearTimeout(this.#timers.get(run.id));
    this.#timers.set(run.id, setTimeout(() => this.#flush(run.id), SAVE_DEBOUNCE_MS));
  }

  /** Write everything still pending. Called on shutdown. */
  async flushAll() {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    await Promise.all([...this.#dirty].map((id) => this.#flush(id)));
    await this.#store.close();
  }

  get pendingSaves() {
    return this.#dirty.size;
  }

  async #flush(id) {
    this.#timers.delete(id);
    const run = this.#runs.get(id);
    if (!run) return;
    try {
      await this.#store.save(run);
      this.#dirty.delete(id);
    } catch (err) {
      console.error(`Failed to save run ${id}: ${err.message}`);
    }
  }
}
