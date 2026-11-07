// The run document: how a run is created and how older documents are brought up to date.
//
// Shape:
//   {
//     id, name, game, createdAt, updatedAt,
//     players:    [{ id: "p1".."p4", name, color, sprite }],
//     routes:     [{ id, name, wipe?: { by, byName, at, prev } }],
//     encounters: { [routeId]: { [playerId]: { species, dexId, nickname, status, updatedAt } } },
//     badges:     0..8,                // gym badges in the current attempt
//     history:    [archived attempts]  // see ops.js → resetRun
//   }

import { randomBytes } from "node:crypto";
import { str } from "./validate.js";

export const PLAYER_COUNT = 4;
export const MAX_ROUTES = 400;
export const MAX_HISTORY = 100;
export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
export const STATUSES = new Set(["alive", "dead", "missed", "none"]);

export const uid = (length = 8) =>
  randomBytes(length).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, length);

export const newRoute = (name) => ({ id: uid(), name });

export function createRun({ name, game, players, routes }, isTaken) {
  const now = Date.now();
  let id;
  do id = uid(6).toUpperCase();
  while (isTaken(id));

  const routeNames = (Array.isArray(routes) ? routes : []).map((r) => str(r, 60)).filter(Boolean).slice(0, MAX_ROUTES);

  return {
    id,
    name: str(name) || "Our Nuzlocke",
    game: str(game) || "Emerald",
    createdAt: now,
    updatedAt: now,
    players: Array.from({ length: PLAYER_COUNT }, (_, i) => ({
      id: `p${i + 1}`,
      name: str(players?.[i], 24) || `Player ${i + 1}`,
      color: PLAYER_COLORS[i],
      sprite: null,
    })),
    routes: routeNames.map(newRoute),
    encounters: {},
    badges: 0,
    history: [],
  };
}

/** Normalises documents written by earlier versions of the app. Mutates and returns `run`. */
export function migrate(run) {
  run.history ??= [];
  run.badges ??= 0;
  for (const row of Object.values(run.encounters ?? {})) {
    for (const enc of Object.values(row)) if (enc.status === "boxed") enc.status = "alive";
  }
  delete run.log;
  delete run.rules;
  delete run.attemptCount;
  return run;
}
