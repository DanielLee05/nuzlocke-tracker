// Graveyard tab (views/graveyard.html): every fallen Pokémon, one column per player.

import { $, clone, fill, mount, playerSlots, slot } from "../lib/dom.js";
import { pokemonSprite } from "../models/sprites.js";
import { encountersOf, isDead, state } from "../models/state.js";

export function updateGraveyard() {
  const { players } = state.run;
  playerSlots($("#graveyard"), players).forEach((column, i) => {
    const p = players[i];
    const fallen = encountersOf(p.id).filter(isDead);
    column.style.setProperty("--c", p.color);
    column.toggleAttribute("data-empty", fallen.length === 0);
    fill(column, { name: p.name, count: `${fallen.length} dead` });
    mount(slot(column, "list"), fallen.map(tombstone));
  });
}

function tombstone({ route, encounter }) {
  const el = clone("tombstone");
  const img = slot(el, "sprite");
  img.hidden = !encounter.dexId;
  if (encounter.dexId) img.src = pokemonSprite(encounter.dexId);
  img.onerror = () => (img.hidden = true);
  return fill(el, {
    name: encounter.nickname || encounter.species,
    detail: encounter.nickname ? `${encounter.species} · ${route.name}` : route.name,
  });
}
