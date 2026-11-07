// DOM helpers. All markup lives in views/*.html; controllers only fill text,
// toggle data-* attributes (styled by Tailwind variants) and clone <template>s for lists.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Clone the element inside `<template id="tpl-{name}">`. */
export function clone(name) {
  const template = document.getElementById(`tpl-${name}`);
  if (!template) throw new Error(`Missing template "tpl-${name}"`);
  return template.content.firstElementChild.cloneNode(true);
}

/** The element marked `data-slot="{name}"` inside `root`. */
export const slot = (root, name) => root.querySelector(`[data-slot="${name}"]`);

/** Set the text of several slots at once: fill(card, { name: "Ash", alive: "3 alive" }). */
export function fill(root, values) {
  for (const [name, value] of Object.entries(values)) slot(root, name).textContent = value;
  return root;
}

/** Replace all children of `el` with `nodes` (arrays are flattened). */
export function mount(el, ...nodes) {
  el.replaceChildren(...nodes.flat());
  return el;
}

/** The element inside `root` for player `id` (`data-pid="{id}"`). */
export const byPlayer = (root, id) => root.querySelector(`[data-pid="${id}"]`);

/**
 * Markup that repeats per player is written out once per player with an empty `data-pid`.
 * Assign the real ids in order and return the elements.
 */
export function playerSlots(root, players) {
  const els = $$("[data-pid]", root);
  players.forEach((p, i) => (els[i].dataset.pid = p.id));
  return els;
}

/** "1 badge", "3 badges" */
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Debounce a zero-argument function. */
export function debounce(fn, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

let toastTimer;
export function toast(message, { error = false } = {}) {
  const el = $("#toast");
  el.textContent = message;
  el.toggleAttribute("data-error", error);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2500);
}
