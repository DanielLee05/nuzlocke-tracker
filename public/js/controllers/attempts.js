// Runs tab (views/attempts.html): archived attempts, resetting the run, deleting attempts.

import { $, clone, fill, mount, playerSlots, plural, slot, toast } from "../lib/dom.js";
import { pokemonSprite } from "../models/sprites.js";
import { currentAttempt, encountersOf, isDead, state } from "../models/state.js";
import { send } from "../services/socket.js";

export function initAttempts() {
  $("#reset-run").addEventListener("click", () => {
    if (!state.actor) return toast("Choose who you are (top right) before resetting", { error: true });
    $("#reset-attempt").textContent = `#${currentAttempt()}`;
    $("#reset-reason").value = "";
    $("#reset-dialog").showModal();
    $("#reset-reason").focus();
  });
  $("#reset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    send({ type: "resetRun", reason: $("#reset-reason").value.trim() });
    $("#reset-dialog").close();
  });
  $("#reset-cancel").addEventListener("click", () => $("#reset-dialog").close());

  $("#runs").addEventListener("click", (e) => {
    const button = e.target.closest("[data-action=delete-attempt]");
    if (!button) return;
    const attempt = state.run.history.find((a) => a.id === button.dataset.attempt);
    if (attempt && confirm(`Delete archived attempt #${attempt.number}? This cannot be undone.`)) {
      send({ type: "deleteAttempt", attemptId: attempt.id });
    }
  });
}

export function updateAttempts() {
  const { history } = state.run;
  mount($("#runs"), [...history].reverse().map(attemptCard));
  const empty = $("#runs-empty");
  empty.hidden = history.length > 0;
  fill(empty, { attempt: `#${currentAttempt()}` });
}

function attemptCard(a) {
  const card = clone("attempt-card");
  const resetter = a.players.find((p) => p.id === a.resetBy);
  $("[data-action=delete-attempt]", card).dataset.attempt = a.id;
  slot(card, "resetter-swatch").style.setProperty("--c", resetter?.color ?? "#888");
  card.toggleAttribute("data-reason", Boolean(a.reason));
  fill(card, {
    number: `#${a.number}`,
    summary: `${plural(a.badges ?? 0, "badge")} · Ended ${new Date(a.endedAt).toLocaleString()}`,
    resetter: a.resetByName ?? resetter?.name ?? "Unknown",
    reason: a.reason ?? "",
  });

  playerSlots(card, a.players).forEach((block, i) => {
    const p = a.players[i];
    const team = encountersOf(p.id, a);
    const dead = team.filter(isDead).length;
    block.style.setProperty("--c", p.color);
    block.toggleAttribute("data-empty", team.length === 0);
    fill(block, { name: p.name, alive: `${team.length - dead} alive`, dead: `${dead} dead` });
    slot(block, "team").append(...team.map(teamSprite));
  });
  return card;
}

function teamSprite({ route, encounter }) {
  const img = clone("attempt-sprite");
  const dead = encounter.status === "dead";
  img.title = [encounter.nickname, encounter.species, route.name].filter(Boolean).join(" · ") + (dead ? " (dead)" : "");
  img.toggleAttribute("data-dead", dead);
  if (encounter.dexId) img.src = pokemonSprite(encounter.dexId);
  img.onerror = () => img.remove();
  return img;
}
