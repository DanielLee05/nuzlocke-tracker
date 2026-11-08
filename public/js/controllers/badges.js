// Gym badge row (views/badges.html). Icons are PNGs in public/badges/.

import { $, $$ } from "../lib/dom.js";
import { state } from "../models/state.js";
import { send } from "../services/socket.js";

const buttons = () => $$("#badge-row [data-badge]");

export function initBadges() {
  $("#badge-row").addEventListener("click", (e) => {
    const button = e.target.closest("[data-badge]");
    if (!button) return;
    const n = Number(button.dataset.badge);
    send({ type: "setBadges", badges: n === state.run.badges ? n - 1 : n }); // clicking the last badge un-earns it
  });
}

export function updateBadges() {
  buttons().forEach((button, i) => (button.ariaPressed = String(i < state.run.badges)));
}
