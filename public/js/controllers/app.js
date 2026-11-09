// Entry point for the run page. Wires the controllers together and re-renders on every
// state message from the server.

import { $, toast } from "../lib/dom.js";
import { readJson, writeJson } from "../lib/storage.js";
import { loadAbilities, loadDex } from "../models/dex.js";
import { runId, state } from "../models/state.js";
import { connect } from "../services/socket.js";
import { initAttempts, updateAttempts } from "./attempts.js";
import { initBadges, updateBadges } from "./badges.js";
import { initEncounterDialog } from "./encounterDialog.js";
import { updateGraveyard } from "./graveyard.js";
import { fitGridHeight, initGrid, updateGrid } from "./grid.js";
import { flashPresence, initHeader, showConnectionStatus, updateHeader } from "./header.js";
import { focusPokemonSearch, initLookups } from "./lookup.js";
import { initPlayers, updatePlayers } from "./players.js";
import { updateStats } from "./stats.js";
import { initTabs, isTabVisible } from "./tabs.js";
import { initTips } from "./tips.js";

const RECENT_KEY = "nuz:recent";
const MAX_RECENT = 8;

function renderAll() {
  updateHeader();
  updatePlayers();
  updateBadges();
  updateGrid();
  updateGraveyard();
  updateAttempts();
  updateStats();
  if (isTabVisible("encounters")) fitGridHeight();
}

function rememberRecentRun(run) {
  const others = readJson(RECENT_KEY, []).filter((r) => r.id !== run.id);
  writeJson(RECENT_KEY, [{ id: run.id, name: run.name, game: run.game }, ...others].slice(0, MAX_RECENT));
}

async function boot() {
  initTabs({
    onShow(tab) {
      if (tab === "encounters") fitGridHeight();
      if (tab === "lookup") focusPokemonSearch();
    },
  });
  initHeader({ onActorChange: renderAll });
  initPlayers();
  initBadges();
  initGrid();
  initEncounterDialog();
  initAttempts();
  initLookups();
  initTips();

  await loadDex(); // species names must be ready before the grid renders sprites
  await loadAbilities();

  connect({
    onState(run, from) {
      const first = !state.run;
      state.run = run;
      if (first) {
        $("#app").hidden = false;
        rememberRecentRun(run);
      }
      renderAll();
      if (from && from !== state.actor && !first) flashPresence();
    },
    onPresence(online) {
      state.online = online;
      if (state.run) updateHeader();
    },
    onNotFound() {
      $("#app").hidden = true;
      $("#notfound").hidden = false;
      showConnectionStatus("not found", "bad");
      writeJson(RECENT_KEY, readJson(RECENT_KEY, []).filter((r) => r.id !== runId));
    },
    onError: (message) => toast(message, { error: true }),
    onStatus: showConnectionStatus,
  });
}

boot();
