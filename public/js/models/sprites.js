// External sprite sources.

export const pokemonSprite = (dexId) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;

export const trainerSprite = (id) => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;

/** Protagonist sprites players can pick for their card (Pokémon Showdown trainer set ids). */
export const TRAINERS = [
  ["red-gen1", "Red (RBY)"], ["red-gen3", "Red (FRLG)"], ["leaf-gen3", "Leaf (FRLG)"], ["red", "Red (HGSS)"],
  ["ethan-gen2", "Gold (GSC)"], ["kris-gen2", "Kris (Crystal)"], ["ethan", "Ethan (HGSS)"], ["lyra", "Lyra (HGSS)"],
  ["brendan-gen3rs", "Brendan (RS)"], ["may-gen3rs", "May (RS)"], ["brendan-gen3", "Brendan (Emerald)"], ["may-gen3", "May (Emerald)"],
  ["brendan", "Brendan (ORAS)"], ["may", "May (ORAS)"],
  ["lucas-gen4pt", "Lucas (Platinum)"], ["dawn-gen4pt", "Dawn (Platinum)"], ["lucas", "Lucas (BDSP)"], ["dawn", "Dawn (BDSP)"],
  ["hilbert", "Hilbert (BW"], ["hilda", "Hilda (BW)"], ["nate", "Nate (BW2)"], ["rosa", "Rosa (BW2)"],
  ["calem", "Calem (XY)"], ["serena", "Serena (XY)"],
  ["elio", "Elio (SM)"], ["selene", "Selene (SM)"],
  ["victor", "Victor (SH)"], ["gloria", "Gloria (SH)"],
  ["rei", "Rei (LA)"], ["akari", "Akari (LA)"],
].map(([id, label]) => ({ id, label }));
