// Pokédex data from PokeAPI, cached in localStorage.

import { readJson, writeJson } from "../lib/storage.js";

const SPECIES_CACHE_KEY = "nuz:dex:v1";
const POKEMON_CACHE_KEY = "nuz:pokemon:v1";
const ABILITIES_CACHE_KEY = "nuz:abilities:v1"
const ABILITY_CACHE_KEY = "nuz:ability:v1"
const MAX_SUGGESTIONS = 8;

/** [{ id, name, label }] — populated by loadDex(). */
export let dex = [];
export let abilities = [];

const SPECIAL_NAMES = [
  [/^Mr /, "Mr. "], [/^Mime Jr$/, "Mime Jr."], [/Ho Oh/, "Ho-Oh"], [/Porygon Z/, "Porygon-Z"],
  [/Jangmo O/, "Jangmo-o"], [/Hakamo O/, "Hakamo-o"], [/Kommo O/, "Kommo-o"],
];

/** "mr-mime" -> "Mr. Mime" */
export function titleCase(slug) {
  const words = slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return SPECIAL_NAMES.reduce((s, [pattern, fix]) => s.replace(pattern, fix), words);
}

export async function loadDex() {
  dex = readJson(SPECIES_CACHE_KEY, null);
  if (dex) return;
  try {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000");
    const { results } = await res.json();
    dex = results.map((r) => {
      const id = Number(r.url.split("/").filter(Boolean).pop());
      return { id, name: r.name, label: titleCase(r.name) };
    });
    writeJson(SPECIES_CACHE_KEY, dex);
  } catch { 
    dex = [];
  }
}

export const dexById = (id) => dex.find((d) => d.id === Number(id));

export function dexByLabel(label) {
  const needle = String(label ?? "").trim().toLowerCase();
  return needle ? dex.find((d) => d.label.toLowerCase() === needle) : undefined;
}

/** Prefix matches first, then substring matches, capped at MAX_SUGGESTIONS. */
export function searchDex(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = dex.filter((d) => d.label.toLowerCase().startsWith(q)).slice(0, MAX_SUGGESTIONS);
  const remaining = MAX_SUGGESTIONS - starts.length;
  const contains = remaining
    ? dex.filter((d) => !starts.includes(d) && d.label.toLowerCase().includes(q)).slice(0, remaining)
    : [];
  return [...starts, ...contains];
}

/** Types + base Speed from PokeAPI, cached per dex id. One request serves both lookups. */
export async function fetchPokemon(dexId) {
  const cache = readJson(POKEMON_CACHE_KEY, {});
  if (cache[dexId]) return cache[dexId];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
  if (!res.ok) throw new Error(`No Pokémon data for #${dexId}`);
  const data = await res.json();
  cache[dexId] = {
    types: data.types.sort((a, b) => a.slot - b.slot).map((t) => titleCase(t.type.name)),
    speed: data.stats.find((s) => s.stat.name === "speed")?.base_stat ?? null,
  };
  writeJson(POKEMON_CACHE_KEY, cache);
  return cache[dexId];
}

export async function loadAbilities(){
  abilities = readJson(ABILITIES_CACHE_KEY, null);
  if (abilities) return;
  try{
    const res = await fetch("https://pokeapi.co/api/v2/ability?limit=400")
    const { results } = await res.json();
    abilities = results.map((r) => {
      const id = Number(r.url.split("/").filter(Boolean).pop());
      return { id, name: r.name, label: titleCase(r.name)};
    });
    writeJson(ABILITIES_CACHE_KEY, abilities);
  }
  catch{
    abilities = [];
  }
}

/** Prefix matches first, then substring matches, capped at MAX_SUGGESTIONS. */
export function searchAbilities(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = abilities.filter((d) => d.label.toLowerCase().startsWith(q)).slice(0, MAX_SUGGESTIONS);
  const remaining = MAX_SUGGESTIONS - starts.length;
  const contains = remaining
    ? abilities.filter((d) => !starts.includes(d) && d.label.toLowerCase().includes(q)).slice(0, remaining)
    : [];
  return [...starts, ...contains];
}

export async function fetchAbility(id) {
  const cache = readJson(ABILITY_CACHE_KEY, {});
  if (cache[id]) return cache[id];
  const res = await fetch(`https://pokeapi.co/api/v2/ability/${id}`);
  if (!res.ok) throw new Error(`No ability data for #${id}`);
  const data = await res.json();
  cache[id] = {
    shortEffect: data.effect_entries.find((e) => e.language.name === "en")?.short_effect ?? null,
  };
  writeJson(ABILITY_CACHE_KEY, cache);
  return cache[id];
}

export const fetchTypes = async (dexId) => (await fetchPokemon(dexId)).types;

/** Base Speed stat (the number on the summary screen), or null if PokeAPI omitted it. */
export const fetchSpeed = async (dexId) => (await fetchPokemon(dexId)).speed;
