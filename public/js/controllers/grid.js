// Encounter grid (views/grid.html): one row per route, one column per player.
// Handles cell clicks, route add/rename/remove/reorder and the per-route wipe box.

import { $, $$, clone, debounce, fill, mount, playerSlots, slot } from "../lib/dom.js";
import { dexByLabel } from "../models/dex.js";
import { pokemonSprite } from "../models/sprites.js";
import { canEdit, player, state } from "../models/state.js";
import { send } from "../services/socket.js";
import { openEncounter } from "./encounterDialog.js";
import { explainLock } from "./players.js";

const MIN_HEIGHT_PX = 200;
const BOTTOM_GAP_PX = 16;

export function initGrid() {
  const wrap = $("#grid-wrap");

  $("#add-route").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.elements.name;
    send({ type: "addRoutes", names: [input.value], prepend: true });
    input.value = "";
    wrap.scrollTop = 0;
  });

  wrap.addEventListener("click", (e) => {
    if (e.target.closest("[data-action=wipe]")) return; // handled by "change"

    const remove = e.target.closest("[data-action=remove-route]");
    if (remove) {
      const route = routeOf(remove);
      if (confirm(`Remove "${route.name}" and all its encounters?`)) send({ type: "removeRoute", routeId: route.id });
      return;
    }

    const cell = e.target.closest("td[data-pid]");
    if (!cell) return;
    if (!canEdit(cell.dataset.pid)) return explainLock(cell.dataset.pid);
    openEncounter(routeOf(cell).id, cell.dataset.pid);
  });

  wrap.addEventListener("dblclick", (e) => {
    const th = e.target.closest("th.route-th");
    if (!th || e.target.closest("label")) return;
    const route = routeOf(th);
    const name = prompt("Rename route", route.name)?.trim();
    if (name && name !== route.name) send({ type: "renameRoute", routeId: route.id, name });
  });

  wrap.addEventListener("change", (e) => {
    const checkbox = e.target.closest("[data-action=wipe]");
    if (!checkbox) return;
    if (!state.actor) {
      checkbox.checked = !checkbox.checked;
      return explainLock(null);
    }
    send({ type: "setRouteWipe", routeId: routeOf(checkbox).id, wiped: checkbox.checked });
  });

  initDragReorder(wrap);
  window.addEventListener("resize", debounce(() => state.run && fitGridHeight(), 60));
}

export function updateGrid() {
  const { players, routes, encounters } = state.run;
  const wrap = $("#grid-wrap");
  const scrollTop = wrap.scrollTop;

  playerSlots($("#grid-wrap thead"), players).forEach((th, i) => {
    th.style.setProperty("--c", players[i].color);
    th.title = players[i].name;
    fill(th, { name: players[i].name });
  });
  mount($("#grid-rows"), routes.map((route, index) => routeRow(route, index, encounters[route.id] ?? {}, players)));
  $("#grid-empty").hidden = routes.length > 0;

  fitGridHeight();
  wrap.scrollTop = scrollTop;
}

/** Size the card to the remaining viewport so the page never scrolls; the card scrolls instead. */
export function fitGridHeight() {
  const wrap = $("#grid-wrap");
  const top = wrap.getBoundingClientRect().top;
  wrap.style.height = `${Math.max(MIN_HEIGHT_PX, window.innerHeight - top - BOTTOM_GAP_PX)}px`;
}

// ---------- rows & cells ----------

function routeRow(route, index, rowEncounters, players) {
  const tr = clone("grid-row");
  const wipe = route.wipe;
  tr.dataset.route = route.id;
  tr.dataset.index = index;
  tr.toggleAttribute("data-wiped", Boolean(wipe));
  tr.style.setProperty("--wipe-c", wipe ? player(wipe.by)?.color : "var(--color-dead)");

  slot(tr, "name").title = `${route.name} – drag to reorder, double-click to rename`;
  $("[data-action=wipe]", tr).checked = Boolean(wipe);
  slot(tr, "wipe-label").title = wipe
    ? `Marked dead by ${wipe.byName} · ${new Date(wipe.at).toLocaleString()}`
    : "Check if everyone's Pokémon from this route died";
  fill(tr, { name: route.name, "wipe-by": wipe?.byName ?? "" });

  playerSlots(tr, players).forEach((td, i) => fillCell(td, rowEncounters[players[i].id], players[i].id));
  return tr;
}

/** Cell content is chosen by data-kind (empty | missed | pokemon) and coloured by data-status. */
function fillCell(td, enc, playerId) {
  td.toggleAttribute("data-locked", !canEdit(playerId));

  if (!enc?.species) {
    td.dataset.kind = enc?.status === "missed" ? "missed" : "empty";
    return;
  }
  td.dataset.kind = "pokemon";
  td.dataset.status = enc.status;
  td.title = (enc.nickname ? `${enc.nickname} (${enc.species})` : enc.species) + (enc.status === "dead" ? " – dead" : "");
  fill(td, { name: enc.nickname || enc.species });

  const dexId = enc.dexId || dexByLabel(enc.species)?.id;
  const img = slot(td, "sprite");
  img.hidden = !dexId;
  if (dexId) img.src = pokemonSprite(dexId);
  img.onerror = () => (img.hidden = true);
}

/** The route for any element inside a grid row. */
const routeOf = (el) => state.run.routes.find((r) => r.id === el.closest("tr[data-route]").dataset.route);

// ---------- drag-and-drop reordering (feedback via tr[data-drag]) ----------

function initDragReorder(wrap) {
  let draggingId = null;
  const rowUnder = (e) => draggingId && e.target.closest("tr[data-route]");
  const isBelowMidpoint = (row, e) => {
    const { top, height } = row.getBoundingClientRect();
    return e.clientY > top + height / 2;
  };
  const clearDrag = (selector) => $$(`#grid-rows ${selector}`).forEach((el) => delete el.dataset.drag);

  wrap.addEventListener("dragstart", (e) => {
    const th = e.target.closest("th.route-th");
    if (!th || e.target.closest("label")) return e.preventDefault();
    draggingId = routeOf(th).id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggingId);
    th.closest("tr").dataset.drag = "source";
  });

  wrap.addEventListener("dragover", (e) => {
    const row = rowUnder(e);
    if (!row) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (row.dataset.route === draggingId) return;
    clearDrag("[data-drag]:not([data-drag=source])");
    row.dataset.drag = isBelowMidpoint(row, e) ? "after" : "before";
  });

  wrap.addEventListener("drop", (e) => {
    const row = rowUnder(e);
    if (!row || row.dataset.route === draggingId) return;
    e.preventDefault();
    const from = state.run.routes.findIndex((r) => r.id === draggingId);
    let to = Number(row.dataset.index) + (isBelowMidpoint(row, e) ? 1 : 0);
    if (from < to) to -= 1; // the dragged row is removed before being re-inserted
    if (to !== from) send({ type: "reorderRoute", routeId: draggingId, toIndex: to });
  });

  wrap.addEventListener("dragend", () => {
    draggingId = null;
    clearDrag("[data-drag]");
  });
}
