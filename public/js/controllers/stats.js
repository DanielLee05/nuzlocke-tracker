// Stats tab (views/stats.html): per-player and per-attempt figures derived from the run.

import { $, fill, playerSlots, plural } from "../lib/dom.js";
import { currentAttempt, state } from "../models/state.js";

export function updateStats() {
  const { run } = state;
  const { players } = run;
  const attempts = allAttempts(run);

  const rows = players.map((p) => {
    const caused = attempts.reduce((sum, a) => sum + deathsCausedBy(p.id, a), 0);
    return { caused, average: caused / attempts.length, resets: run.history.filter((a) => a.resetBy === p.id).length };
  });
  const maxResets = Math.max(0, ...rows.map((r) => r.resets));
  const furthest = attempts.reduce((best, a) => (a.badges > (best?.badges ?? -1) ? a : best), null);

  // "Most likely to wipe": show the chip of every player tied for most resets.
  const wipers = $("#stat-wipers");
  wipers.toggleAttribute("data-empty", maxResets === 0);
  playerSlots(wipers, players).forEach((chip, i) => {
    chip.style.setProperty("--c", players[i].color);
    chip.toggleAttribute("data-on", maxResets > 0 && rows[i].resets === maxResets);
    fill(chip, { name: players[i].name });
  });
  fill(wipers, { detail: maxResets ? plural(maxResets, "reset") : "" });

  fill($("#stat-furthest"), {
    value: furthest ? `Attempt #${furthest.number}${furthest.current ? " (current)" : ""}` : "—",
    detail: furthest ? plural(furthest.badges, "badge") : "",
  });
  fill($("#stat-attempts"), { value: String(attempts.length), lost: String(run.history.length) });

  playerSlots($("#stat-rows"), players).forEach((tr, i) => {
    tr.style.setProperty("--c", players[i].color);
    fill(tr, { name: players[i].name, caused: rows[i].caused, average: rows[i].average.toFixed(1), resets: rows[i].resets });
  });
}

/** Every attempt so far: archived ones plus the one in progress. */
function allAttempts(run) {
  const current = { number: currentAttempt(), routes: run.routes, encounters: run.encounters, badges: run.badges, current: true };
  return [...run.history.map((a) => ({ ...a, badges: a.badges ?? 0 })), current];
}

/** Deaths "caused" by a player = Pokémon that died in rows that player marked as wiped. */
function deathsCausedBy(playerId, attempt) {
  return attempt.routes
    .filter((route) => route.wipe?.by === playerId)
    .reduce((sum, route) => {
      const row = Object.values(attempt.encounters[route.id] ?? {});
      return sum + row.filter((e) => e.species && e.status === "dead").length;
    }, 0);
}
