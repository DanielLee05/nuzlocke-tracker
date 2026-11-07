// Landing page (views/landing.html): create a run, join by code, manage the recent-runs list.

import { $, clone, fill, mount, slot } from "../lib/dom.js";
import { readJson, writeJson } from "../lib/storage.js";
import { EMERALD_ROUTES } from "../models/routes.js";

const RECENT_KEY = "nuz:recent";
const DEFAULT_GAME = "Emerald";

let recent = readJson(RECENT_KEY, []);
renderRecentRuns();

$("#recent-list").addEventListener("click", (e) => {
  const button = e.target.closest("[data-action=remove]");
  if (!button) return;
  recent = recent.filter((r) => r.id !== button.closest("li").dataset.id);
  writeJson(RECENT_KEY, recent);
  renderRecentRuns();
});

$("#create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const submit = $("button[type=submit]", e.target);
  submit.disabled = true;
  try {
    const run = await createRun({
      name: form.get("name"),
      game: DEFAULT_GAME,
      players: ["p1", "p2", "p3", "p4"].map((key) => form.get(key)),
      routes: EMERALD_ROUTES,
    });
    location.href = `/run/${run.id}`;
  } catch (err) {
    alert(`Could not create run: ${err.message}`);
    submit.disabled = false;
  }
});

$("#join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = new FormData(e.target).get("code").trim().toUpperCase();
  if (code) location.href = `/run/${code}`;
});

function renderRecentRuns() {
  $("#recent").hidden = recent.length === 0;
  mount(
    $("#recent-list"),
    recent.map((run) => {
      const li = clone("recent-run");
      li.dataset.id = run.id;
      slot(li, "link").href = `/run/${run.id}`;
      $("[data-action=remove]", li).ariaLabel = `Remove ${run.name} from recent runs`;
      return fill(li, { name: run.name, code: run.id });
    })
  );
}

async function createRun(body) {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`server responded ${res.status}`);
  return res.json();
}
