// Stats tab (views/stats.html): per-player and per-attempt figures derived from the run.

import { $, fill, playerSlots, plural } from "../lib/dom.js";
import { currentAttempt, encountersOf, isDead, state } from "../models/state.js";

export function updateStats() {
  const { run } = state;
  const { players } = run;
  const attempts = allAttempts(run);

  const rows = players.map((p) => {
    const lost = attempts.reduce((sum, a) => sum + deathsOf(p.id, a), 0);
    const caused = attempts.reduce((sum, a) => sum + deathsCausedBy(p.id, a), 0);
    return {
      lost,
      avgLost: lost / attempts.length,
      caused,
      avgCaused: caused / attempts.length,
      resets: run.history.filter((a) => a.resetBy === p.id).length,
    };
  });

  const furthest = attempts.reduce((best, a) => (a.badges > (best?.badges ?? -1) ? a : best), null);

  const maxResets = showTiedLeaders($("#stat-wipers"), players, rows.map((r) => r.resets));
  fill($("#stat-wipers"), { detail: maxResets ? plural(maxResets, "reset") : "" });

  const maxLost = showTiedLeaders($("#stat-deaths"), players, rows.map((r) => r.lost));
  fill($("#stat-deaths"), { detail: maxLost ? `${maxLost} fellas dead` : "" });

  fill($("#stat-furthest"), {
    value: furthest ? `Attempt #${furthest.number}${furthest.current ? " (current)" : ""}` : "—",
    detail: furthest ? plural(furthest.badges, "badge") : "",
  });
  fill($("#stat-attempts"), { value: String(attempts.length) });

  playerSlots($("#stat-rows"), players).forEach((tr, i) => {
    const { lost, avgLost, caused, resets } = rows[i];
    tr.style.setProperty("--c", players[i].color);
    fill(tr, { name: players[i].name, lost, "avg-lost": avgLost.toFixed(1), caused, resets });
  });
}

/** Light up every player tied for the highest score; hide the chips when the max is 0. */
function showTiedLeaders(card, players, scores) {
  const max = Math.max(0, ...scores);
  card.toggleAttribute("data-empty", max === 0);
  playerSlots(card, players).forEach((chip, i) => {
    chip.style.setProperty("--c", players[i].color);
    chip.toggleAttribute("data-on", max > 0 && scores[i] === max);
    fill(chip, { name: players[i].name });
  });
  return max;
}

/** Archived attempts plus the one in progress. */
function allAttempts(run) {
  const current = { number: currentAttempt(), routes: run.routes, encounters: run.encounters, badges: run.badges, current: true };
  return [...run.history.map((a) => ({ ...a, badges: a.badges ?? 0 })), current];
}

/** How many of this player's own Pokémon died in an attempt. */
function deathsOf(playerId, attempt) {
  return encountersOf(playerId, attempt).filter(isDead).length;
}

/** Deaths "caused" = Pokémon that died in rows this player marked as wiped. */
function deathsCausedBy(playerId, attempt) {
  return attempt.routes
    .filter((route) => route.wipe?.by === playerId)
    .reduce((sum, route) => {
      const row = Object.values(attempt.encounters[route.id] ?? {});
      return sum + row.filter((e) => e.species && e.status === "dead").length;
    }, 0);
}
