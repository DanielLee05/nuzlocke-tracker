// External sprite sources.

export const pokemonSprite = (dexId) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;

export const trainerSprite = (id) => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;

/** Protagonist sprites players can pick for their card (Pokémon Showdown trainer set ids). */
export const TRAINERS = [
  ["red-gen1", "Red (RBY)"], ["red-gen3", "Red (FRLG)"], ["leaf-gen3", "Leaf (FRLG)"], ["red", "Red (HGSS)"],
  ["ethan-gen2", "Gold (GSC)"], ["kris-gen2", "Kris (Crystal)"], ["ethan", "Ethan (HGSS)"], ["lyra", "Lyra (HGSS)"], ["kris", "Kris"],
  ["brendan-gen3rs", "Brendan (RS)"], ["may-gen3rs", "May (RS)"], ["brendan-gen3", "Brendan (Emerald)"], ["may-gen3", "May (Emerald)"],
  ["brendan", "Brendan (ORAS)"], ["may", "May (ORAS)"],
  ["lucas-gen4pt", "Lucas (Platinum)"], ["dawn-gen4pt", "Dawn (Platinum)"], ["lucas", "Lucas (BDSP)"], ["dawn", "Dawn (BDSP)"],
  ["hilbert", "Hilbert"], ["hilda", "Hilda"], ["nate", "Nate"], ["rosa", "Rosa"],
  ["calem", "Calem"], ["serena", "Serena"],
  ["elio", "Elio"], ["selene", "Selene"],
  ["victor", "Victor"], ["gloria", "Gloria"],
  ["rei", "Rei"], ["akari", "Akari"],
  ["florian-s", "Florian"], ["juliana-s", "Juliana"],
].map(([id, label]) => ({ id, label }));
