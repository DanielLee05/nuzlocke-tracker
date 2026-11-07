// Species autocomplete for a text input + suggestion list (rows from views/suggestions.html).
//
//   attachSpeciesAutocomplete(input, list, {
//     onPick(entry)      a suggestion was chosen (click, or Enter on the first one)
//     onInput()          optional, every keystroke
//     pickExactOnEnter   when no suggestions are showing, Enter picks an exact label match
//                        instead of falling through (e.g. to a form submit)
//   })

import { $, clone, fill, mount, slot } from "../lib/dom.js";
import { dexById, dexByLabel, searchDex } from "../models/dex.js";
import { pokemonSprite } from "../models/sprites.js";

const BLUR_HIDE_DELAY_MS = 100;

export function attachSpeciesAutocomplete(input, list, { onPick, onInput, pickExactOnEnter = false }) {
  const hide = () => (list.hidden = true);
  const pick = (entry) => {
    input.value = entry.label;
    hide();
    onPick(entry);
  };

  input.addEventListener("input", () => {
    onInput?.();
    showSuggestions(list, searchDex(input.value));
  });

  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    e.preventDefault(); // keep focus in the input
    pick(dexById(li.dataset.id));
  });

  input.addEventListener("blur", () => setTimeout(hide, BLUR_HIDE_DELAY_MS));

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = !list.hidden && $("li", list);
    const exact = pickExactOnEnter && dexByLabel(input.value);
    if (first) pick(dexById(first.dataset.id));
    else if (exact) pick(exact);
    else return;
    e.preventDefault();
  });
}

/** entries: [{ id, label }] */
function showSuggestions(list, entries) {
  mount(
    list,
    entries.map((entry) => {
      const li = clone("suggestion");
      li.dataset.id = entry.id;
      slot(li, "sprite").src = pokemonSprite(entry.id);
      return fill(li, { name: entry.label, id: `#${entry.id}` });
    })
  );
  list.hidden = entries.length === 0;
}
