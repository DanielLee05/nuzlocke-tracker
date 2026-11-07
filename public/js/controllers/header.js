// Top bar (views/header.html): run name/game edits, invite link, "You are" picker,
// presence dots, connection pill.

import { $, byPlayer, toast } from "../lib/dom.js";
import { currentAttempt, setActor, state } from "../models/state.js";
import { identify, send } from "../services/socket.js";

export function initHeader({ onActorChange }) {
  $("#actor-select").addEventListener("change", (e) => {
    setActor(e.target.value);
    identify(state.actor);
    onActorChange();
  });

  bindEditableText($("#run-name"), () => state.run.name, (name) => send({ type: "setMeta", name }));
  bindEditableText($("#run-game"), () => state.run.game, (game) => send({ type: "setMeta", game }));

  $("#copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Invite link copied");
    } catch {
      prompt("Copy this link", location.href);
    }
  });
}

export function updateHeader() {
  const { run, online, actor } = state;
  document.title = `${run.name} · Nuzlocke Tracker`;
  if (document.activeElement !== $("#run-name")) $("#run-name").textContent = run.name;
  if (document.activeElement !== $("#run-game")) $("#run-game").textContent = run.game;
  $("#run-code").textContent = run.id;
  $("#attempt-number").textContent = `#${currentAttempt()}`;
  $("#actor-select").value = actor;

  for (const p of run.players) {
    byPlayer($("#actor-select"), p.id).textContent = p.name;
    const dot = byPlayer($("#online"), p.id);
    const isOnline = online.includes(p.id);
    dot.style.setProperty("--c", p.color);
    dot.title = `${p.name} ${isOnline ? "online" : "offline"}`;
    dot.toggleAttribute("data-online", isOnline);
  }
}

/** status: "ok" | "bad" | "" — styled by data-[status] variants in the markup. */
export function showConnectionStatus(text, status = "") {
  const el = $("#conn");
  el.textContent = text;
  el.dataset.status = status;
}

/** Briefly highlight the presence dots when another player makes a change. */
export function flashPresence() {
  const el = $("#online");
  el.classList.remove("online-flash");
  void el.offsetWidth; // restart the animation
  el.classList.add("online-flash");
}

/** A contenteditable element that commits on blur and reverts when left empty/unchanged. */
function bindEditableText(el, current, commit) {
  el.addEventListener("blur", () => {
    const value = el.textContent.trim();
    if (value && value !== current()) commit(value);
    else el.textContent = current();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
    }
  });
}
