// Player cards (views/players.html): stats pills, renaming, trainer sprite picking.

import { $, clone, fill, mount, playerSlots, plural, slot, toast } from "../lib/dom.js";
import { TRAINERS, trainerSprite } from "../models/sprites.js";
import { canEdit, encountersOf, isAlive, isDead, player, state } from "../models/state.js";
import { send } from "../services/socket.js";

let pickingFor = null; // player id whose sprite is being chosen

export function initPlayers() {
  const container = $("#players");

  container.addEventListener("click", (e) => {
    const button = e.target.closest("[data-action=pick-sprite]");
    if (!button) return;
    const pid = button.closest("[data-pid]").dataset.pid;
    if (!canEdit(pid)) return explainLock(pid);
    pickingFor = pid;
    openSpritePicker(player(pid));
  });

  // Name edits commit on blur (capture phase: blur doesn't bubble).
  container.addEventListener(
    "blur",
    (e) => {
      const el = e.target.closest?.("[data-slot=name][contenteditable=true]");
      if (!el) return;
      const p = player(el.closest("[data-pid]").dataset.pid);
      const name = el.textContent.trim();
      if (name && name !== p.name) send({ type: "setPlayer", playerId: p.id, name });
      else el.textContent = p.name;
    },
    true
  );
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("[contenteditable]")) {
      e.preventDefault();
      e.target.blur();
    }
  });

  $("#sprite-grid").addEventListener("click", (e) => {
    const option = e.target.closest("[data-sprite]");
    if (!option || !pickingFor) return;
    send({ type: "setPlayer", playerId: pickingFor, sprite: option.dataset.sprite });
    closeSpritePicker();
  });
  $("#sprite-cancel").addEventListener("click", closeSpritePicker);
}

export function updatePlayers() {
  const { players, history } = state.run;
  playerSlots($("#players"), players).forEach((card, i) => {
    const p = players[i];
    const encounters = encountersOf(p.id);
    const editable = canEdit(p.id);

    card.style.setProperty("--c", p.color);
    card.toggleAttribute("data-me", state.actor === p.id);
    card.toggleAttribute("data-locked", !editable);
    card.toggleAttribute("data-sprite", Boolean(p.sprite));
    if (p.sprite) slot(card, "sprite").src = trainerSprite(p.sprite);

    $("[data-action=pick-sprite]", card).title = editable ? "Choose trainer sprite" : `Only ${p.name} can change this`;
    const name = slot(card, "name");
    name.contentEditable = String(editable);
    name.title = editable ? "Click to rename" : "";

    fill(card, {
      name: p.name,
      alive: `${encounters.filter(isAlive).length} alive`,
      dead: `${encounters.filter(isDead).length} dead`,
      resets: plural(history.filter((a) => a.resetBy === p.id).length, "reset"),
    });
  });
}

/** Shown when someone clicks something that belongs to another player. */
export function explainLock(playerId) {
  if (!state.actor) return toast("Choose who you are (top right) first", { error: true });
  toast(`Only ${player(playerId)?.name ?? "that player"} can edit that`, { error: true });
}

// ---------- sprite picker dialog ----------

function openSpritePicker(p) {
  const dialog = $("#sprite-dialog");
  slot(dialog, "player").textContent = p.name;
  slot(dialog, "player").style.color = p.color;
  mount(
    $("#sprite-grid"),
    TRAINERS.map(({ id, label }) => {
      const button = clone("sprite-option");
      button.dataset.sprite = id;
      button.title = label;
      button.ariaPressed = String(p.sprite === id);
      slot(button, "sprite").src = trainerSprite(id);
      slot(button, "sprite").alt = label;
      return fill(button, { label });
    })
  );
  dialog.showModal();
}

const closeSpritePicker = () => $("#sprite-dialog").close();
