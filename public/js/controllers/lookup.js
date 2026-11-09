// Type lookup (views/typeLookup.html) and Pokémon lookup (views/pokemonLookup.html).
// Both fill the shared matchup card in views/lookup/matchup.html.

import { $, $$, clone, fill, mount, slot } from "../lib/dom.js";
import { fetchAbility, fetchPokemon } from "../models/dex.js";
import { pokemonSprite } from "../models/sprites.js";
import { defensiveMatchups, offensiveCoverage } from "../models/typechart.js";
import { attachSpeciesAutocomplete, attachAbilityAutocomplete } from "./autocomplete.js";

const MAX_PICKED_TYPES = 2;
let pickedTypes = [];
let lookupVersion = 0; // ignore responses for a Pokémon the user has since moved on from

export function initLookups() {
  $("#type-picker").addEventListener("click", (e) => {
    const button = e.target.closest("[data-type]");
    if (!button) return;
    const type = button.dataset.type;
    pickedTypes = pickedTypes.includes(type)
      ? pickedTypes.filter((t) => t !== type)
      : [...pickedTypes, type].slice(-MAX_PICKED_TYPES);
    updateTypeLookup();
  });
  updateTypeLookup();

  attachSpeciesAutocomplete($("#lk-species"), $("#lk-suggest"), { onPick: showPokemon, pickExactOnEnter: true });
  attachAbilityAutocomplete($("#lk-ability-search"), $("#lk-ability-suggest"), { onPick: showAbility, pickExactOnEnter: true });
}

export const focusPokemonSearch = () => $("#lk-species").focus();

// ---------- type lookup ----------

function updateTypeLookup() {
  for (const button of $$("#type-picker [data-type]")) button.ariaPressed = String(pickedTypes.includes(button.dataset.type));

  const card = $("#type-result");
  card.dataset.state = pickedTypes.length ? "ready" : "empty";
  if (pickedTypes.length) {
    fillMatchup(card, { types: pickedTypes, title: pickedTypes.join(" / "), offenseTitle: "Attacking", showResisted: true });
  }
}

// ---------- Pokémon lookup ----------

async function showPokemon(entry) {
  const version = ++lookupVersion;
  const card = $("#lk-result");
  card.dataset.state = "loading";
  card.removeAttribute("data-speed");
  slot(card, "sprite").src = pokemonSprite(entry.id);
  fill(card, { title: entry.label, subtitle: `#${entry.id}`, speed: "" });
  mount(slot(card, "types"));

  let pokemon;
  try {
    pokemon = await fetchPokemon(entry.id);
  } catch {
    if (version === lookupVersion) card.dataset.state = "error";
    return;
  }
  if (version !== lookupVersion) return;
  card.dataset.state = "ready";
  fillMatchup(card, {
    types: pokemon.types,
    speed: pokemon.speed,
    title: entry.label,
    subtitle: `#${entry.id}`,
    dexId: entry.id,
    offenseTitle: "Attacking (STAB)",
    showResisted: false,
  });
}

// ---------- Ability lookup ----------

async function showAbility(entry) {
  const version = ++lookupVersion;
  const card = $("#lk-ability");
  card.dataset.state = "loading";

  let ability;
  try {
    ability = await fetchAbility(entry.id);
  } catch {
    if (version === lookupVersion) card.dataset.state = "error";
    return;
  }
  if (version !== lookupVersion) return;
  card.dataset.state = "ready";
  fill(card, {
    title: entry.label,
    effect: ability.shortEffect ?? "No Description"
  });
}

// ---------- shared matchup card ----------

function fillMatchup(card, { types, speed = null, title, subtitle = "", dexId, offenseTitle, showResisted }) {
  const defense = defensiveMatchups(types);
  const offense = offensiveCoverage(types);

  const img = slot(card, "sprite");
  img.hidden = !dexId;
  if (dexId) img.src = pokemonSprite(dexId);
  fill(card, { title, subtitle, "offense-title": offenseTitle, speed: speed ?? "" });
  card.toggleAttribute("data-speed", speed != null);
  mount(slot(card, "types"), types.map(typeTag));

  for (const group of $$("[data-group]", card)) {
    const table = group.dataset.group === "defense" ? defense : offense;
    const matched = table[group.dataset.multiplier] ?? [];
    const resisted = group.dataset.group === "offense" && group.dataset.multiplier !== "2";
    group.hidden = matched.length === 0 || (resisted && !showResisted);
    mount(slot(group, "types"), matched.map(typeTag));
  }
  card.toggleAttribute("data-no-se", offense[2].length === 0);
}

function typeTag(type) {
  const tag = clone("type-tag");
  tag.dataset.type = type;
  tag.textContent = type;
  return tag;
}