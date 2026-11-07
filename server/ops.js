// Operations clients may apply to a run. Each handler validates its input, mutates the run in
// place, and throws an Error with a user-facing message when the change is not allowed.
//
//   applyOp(run, { type: "setBadges", badges: 3 }, actorId)
//
// `actor` is the player id the sender identified as ("p1".."p4"), or null for spectators.
// Per-player data (a player's encounters, name and sprite) may only be changed by that player;
// everything else (routes, wipes, badges, run meta, resets) is shared between all players.

import { MAX_HISTORY, MAX_ROUTES, STATUSES, newRoute, uid } from "./run.js";
import { assert, int, str } from "./validate.js";

const handlers = {
  setEncounter(run, op, ctx) {
    const route = findRoute(run, op.routeId);
    const player = findPlayer(run, op.playerId);
    ctx.requireOwner(player);

    const encounter = sanitizeEncounter(op.encounter);
    const row = (run.encounters[route.id] ??= {});
    if (!encounter.species && encounter.status === "none") delete row[player.id];
    else row[player.id] = encounter;
  },

  setPlayer(run, op, ctx) {
    const player = findPlayer(run, op.playerId);
    ctx.requireOwner(player);

    if (op.name !== undefined) player.name = str(op.name, 24) || player.name;
    if (op.sprite !== undefined) {
      const sprite = str(op.sprite, 40);
      assert(!sprite || /^[a-z0-9-]+$/.test(sprite), "Bad sprite id");
      player.sprite = sprite || null;
    }
  },

  addRoutes(run, op) {
    const names = (Array.isArray(op.names) ? op.names : [op.name]).map((n) => str(n, 60)).filter(Boolean);
    assert(names.length, "Enter a route name");
    assert(run.routes.length + names.length <= MAX_ROUTES, `A run can have at most ${MAX_ROUTES} routes`);

    const routes = names.map(newRoute);
    if (op.prepend) run.routes.unshift(...routes);
    else run.routes.push(...routes);
  },

  renameRoute(run, op) {
    const route = findRoute(run, op.routeId);
    const name = str(op.name, 60);
    assert(name, "Enter a route name");
    route.name = name;
  },

  removeRoute(run, op) {
    const index = run.routes.findIndex((r) => r.id === op.routeId);
    assert(index >= 0, "Unknown route");
    const [route] = run.routes.splice(index, 1);
    delete run.encounters[route.id];
  },

  reorderRoute(run, op) {
    const from = run.routes.findIndex((r) => r.id === op.routeId);
    assert(from >= 0, "Unknown route");
    const to = int(op.toIndex, 0, run.routes.length - 1, from);
    if (to === from) return;
    const [route] = run.routes.splice(from, 1);
    run.routes.splice(to, 0, route);
  },

  // Marks every Pokémon caught on a route as dead (a full-party wipe), remembering who did it
  // and each Pokémon's previous status so the wipe can be undone.
  setRouteWipe(run, op, ctx) {
    const route = findRoute(run, op.routeId);
    const marker = ctx.requireActor();
    const row = (run.encounters[route.id] ??= {});

    if (op.wiped) {
      if (route.wipe) return;
      const prev = {};
      for (const [pid, enc] of Object.entries(row)) {
        if (!enc.species) continue;
        prev[pid] = enc.status;
        enc.status = "dead";
        enc.updatedAt = Date.now();
      }
      route.wipe = { by: marker.id, byName: marker.name, at: Date.now(), prev };
      return;
    }

    if (!route.wipe) return;
    for (const [pid, status] of Object.entries(route.wipe.prev ?? {})) {
      if (row[pid]?.status === "dead") row[pid].status = status;
    }
    delete route.wipe;
  },

  setBadges(run, op) {
    run.badges = int(op.badges, 0, 8, run.badges);
  },

  setMeta(run, op) {
    if (op.name !== undefined) run.name = str(op.name) || run.name;
    if (op.game !== undefined) run.game = str(op.game) || run.game;
  },

  // Archives the current attempt into `history` and clears the board for the next one.
  resetRun(run, op, ctx) {
    const resetter = ctx.requireActor();
    const previous = run.history.at(-1);

    run.history.push({
      id: uid(),
      number: run.history.length + 1,
      reason: str(op.reason, 500),
      startedAt: previous ? previous.endedAt : run.createdAt,
      endedAt: Date.now(),
      resetBy: resetter.id,
      resetByName: resetter.name,
      players: run.players.map(({ id, name, color }) => ({ id, name, color })),
      routes: run.routes.map(({ id, name, wipe }) => ({ id, name, wipe: wipe ?? null })),
      encounters: run.encounters,
      badges: run.badges,
    });
    if (run.history.length > MAX_HISTORY) run.history.shift();

    run.encounters = {};
    run.badges = 0;
    for (const route of run.routes) delete route.wipe;
    renumberHistory(run);
  },

  deleteAttempt(run, op) {
    const index = run.history.findIndex((a) => a.id === op.attemptId);
    assert(index >= 0, "Unknown attempt");
    run.history.splice(index, 1);
    renumberHistory(run);
  },
};

export function applyOp(run, op, actor) {
  const handler = handlers[op.type];
  assert(handler, `Unknown operation "${op.type}"`);
  handler(run, op, context(run, actor));
  run.updatedAt = Date.now();
}

// ---------- helpers ----------

function context(run, actor) {
  const actorPlayer = run.players.find((p) => p.id === actor) ?? null;
  return {
    requireActor() {
      assert(actorPlayer, "Pick who you are (top right) first");
      return actorPlayer;
    },
    requireOwner(player) {
      assert(actorPlayer, "Pick who you are (top right) before editing");
      assert(player.id === actorPlayer.id, `Only ${player.name} can edit that`);
    },
  };
}

function findRoute(run, id) {
  const route = run.routes.find((r) => r.id === id);
  assert(route, "Unknown route");
  return route;
}

function findPlayer(run, id) {
  const player = run.players.find((p) => p.id === id);
  assert(player, "Unknown player");
  return player;
}

function sanitizeEncounter(e = {}) {
  return {
    species: str(e.species, 40),
    dexId: int(e.dexId, 0, 100000) || null,
    nickname: str(e.nickname, 24),
    status: STATUSES.has(e.status) ? e.status : "none",
    updatedAt: Date.now(),
  };
}

/** Attempt numbers are display-only and must stay contiguous after deletes/trims. */
function renumberHistory(run) {
  run.history.forEach((attempt, i) => (attempt.number = i + 1));
}
