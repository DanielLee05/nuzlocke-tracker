// Encounter dialog (views/encounterDialog.html): record one player's encounter on a route.

import { $, slot, toast } from "../lib/dom.js";
import { dexByLabel } from "../models/dex.js";
import { pokemonSprite } from "../models/sprites.js";
import { player, state } from "../models/state.js";
import { send } from "../services/socket.js";
import { attachSpeciesAutocomplete } from "./autocomplete.js";

const DEFAULT_STATUS = "alive";
let editing = null; // { routeId, playerId }

export function initEncounterDialog() {
  const updatePreview = () => showPreview(dexByLabel($("#enc-species").value)?.id);

  attachSpeciesAutocomplete($("#enc-species"), $("#enc-suggest"), {
    onInput: updatePreview,
    onPick: () => {
      updatePreview();
      $("#enc-nick").focus();
    },
  });

  $("#enc-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const species = $("#enc-species").value.trim();
    const status = $("#enc-form input[name=status]:checked")?.value ?? DEFAULT_STATUS;
    if (!species && status !== "missed") return toast("Enter a species or mark as missed", { error: true });
    const entry = dexByLabel(species);
    save({ species: entry?.label ?? species, dexId: entry?.id ?? null, nickname: $("#enc-nick").value, status });
  });
  $("#enc-clear").addEventListener("click", () => save({ status: "none" }));
  $("#enc-cancel").addEventListener("click", close);
}

export function openEncounter(routeId, playerId) {
  const route = state.run.routes.find((r) => r.id === routeId);
  const p = player(playerId);
  if (!route || !p) return;
  editing = { routeId, playerId };
  const encounter = state.run.encounters[routeId]?.[playerId] ?? {};

  const title = $("#enc-title");
  slot(title, "route").textContent = route.name;
  slot(title, "player").textContent = p.name;
  slot(title, "player").style.color = p.color;

  $("#enc-species").value = encounter.species ?? "";
  $("#enc-nick").value = encounter.nickname ?? "";
  const status = encounter.status && encounter.status !== "none" ? encounter.status : DEFAULT_STATUS;
  $(`#enc-form input[name=status][value=${status}]`).checked = true;
  $("#enc-suggest").hidden = true;
  showPreview(encounter.dexId ?? dexByLabel(encounter.species)?.id);

  $("#enc-dialog").showModal();
  $("#enc-species").focus();
}

/** Show the sprite for `dexId`, or hide the preview when there is no match. */
function showPreview(dexId) {
  if (dexId) $("#enc-sprite").src = pokemonSprite(dexId);
  $("#enc-dialog").toggleAttribute("data-preview", Boolean(dexId));
}

function save(encounter) {
  if (editing) send({ type: "setEncounter", ...editing, encounter });
  close();
}

const close = () => $("#enc-dialog").close();
