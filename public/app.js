const runId = location.pathname.split("/").pop().toUpperCase();
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SPRITE = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const STATUS_LABEL = { alive: "Alive", boxed: "Boxed", dead: "Dead", missed: "Missed", none: "" };
const TRAINER = (id) => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;
// Protagonist sprites (Pokémon Showdown trainer set), grouped by generation.
const TRAINERS = [
  { gen: "Kanto", list: [["red-gen1", "Red (RBY)"], ["red-gen3", "Red (FRLG)"], ["leaf-gen3", "Leaf (FRLG)"], ["red", "Red (HGSS)"]] },
  { gen: "Johto", list: [["ethan-gen2", "Gold (GSC)"], ["kris-gen2", "Kris (Crystal)"], ["ethan", "Ethan (HGSS)"], ["lyra", "Lyra (HGSS)"], ["kris", "Kris"]] },
  { gen: "Hoenn", list: [["brendan-gen3rs", "Brendan (RS)"], ["may-gen3rs", "May (RS)"], ["brendan-gen3", "Brendan (Emerald)"], ["may-gen3", "May (Emerald)"], ["brendan", "Brendan (ORAS)"], ["may", "May (ORAS)"]] },
  { gen: "Sinnoh", list: [["lucas-gen4pt", "Lucas (Platinum)"], ["dawn-gen4pt", "Dawn (Platinum)"], ["lucas", "Lucas (BDSP)"], ["dawn", "Dawn (BDSP)"]] },
  { gen: "Unova", list: [["hilbert", "Hilbert"], ["hilda", "Hilda"], ["nate", "Nate"], ["rosa", "Rosa"]] },
  { gen: "Kalos", list: [["calem", "Calem"], ["serena", "Serena"]] },
  { gen: "Alola", list: [["elio", "Elio"], ["selene", "Selene"]] },
  { gen: "Galar", list: [["victor", "Victor"], ["gloria", "Gloria"]] },
  { gen: "Hisui", list: [["rei", "Rei"], ["akari", "Akari"]] },
  { gen: "Paldea", list: [["florian-s", "Florian"], ["juliana-s", "Juliana"]] },
];

let run = null;
let ws = null;
let actor = localStorage.getItem(`nuz:actor:${runId}`) || "";
let online = [];
let reconnectDelay = 500;

// ---------- Pokédex ----------
let dex = []; // [{id, name, label}]
const titleCase = (s) =>
  s
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/^Mr /, "Mr. ")
    .replace(/^Mime Jr$/, "Mime Jr.")
    .replace(/Ho Oh/, "Ho-Oh")
    .replace(/Porygon Z/, "Porygon-Z")
    .replace(/Jangmo O/, "Jangmo-o")
    .replace(/Hakamo O/, "Hakamo-o")
    .replace(/Kommo O/, "Kommo-o");

async function loadDex() {
  const cached = localStorage.getItem("nuz:dex:v1");
  if (cached) {
    dex = JSON.parse(cached);
    return;
  }
  try {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000");
    const json = await res.json();
    dex = json.results.map((r) => {
      const id = Number(r.url.split("/").filter(Boolean).pop());
      return { id, name: r.name, label: titleCase(r.name) };
    });
    localStorage.setItem("nuz:dex:v1", JSON.stringify(dex));
  } catch {
    dex = [];
  }
}
const dexByLabel = (label) => dex.find((d) => d.label.toLowerCase() === String(label).toLowerCase());

// ---------- WebSocket ----------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  setConn("connecting…", "");
  ws.onopen = () => {
    reconnectDelay = 500;
    setConn("live", "ok");
    ws.send(JSON.stringify({ type: "join", runId, actor }));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "state") {
      const first = !run;
      run = msg.run;
      if (first) firstRender();
      render();
      if (msg.from && msg.from !== actor && !first) flashRemote(msg.from);
    } else if (msg.type === "presence") {
      online = msg.online;
      renderOnline();
    } else if (msg.type === "error") {
      if (msg.error === "Run not found") {
        $("#notfound").hidden = false;
        $("#app").hidden = true;
        $("#run-name").textContent = "Not found";
        ws.onclose = null;
        ws.close();
        return;
      }
      toast(msg.error, true);
    }
  };
  ws.onclose = () => {
    setConn("reconnecting…", "bad");
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 8000);
  };
}
function send(op) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return toast("Not connected – change not sent", true);
  ws.send(JSON.stringify({ type: "op", op, opId: Math.random().toString(36).slice(2) }));
}
function setConn(text, cls) {
  const el = $("#conn");
  el.textContent = text;
  el.className = "conn " + cls;
}

// ---------- Rendering ----------
const player = (id) => run.players.find((p) => p.id === id);
const encountersOf = (pid) =>
  run.routes
    .map((r) => ({ route: r, e: run.encounters[r.id]?.[pid] }))
    .filter((x) => x.e && x.e.species);

function firstRender() {
  $("#app").hidden = false;
  $("#run-code").textContent = run.id;
  document.title = `${run.name} · Nuzlocke Tracker`;
  const recent = JSON.parse(localStorage.getItem("nuz:recent") || "[]").filter((r) => r.id !== run.id);
  recent.unshift({ id: run.id, name: run.name });
  localStorage.setItem("nuz:recent", JSON.stringify(recent.slice(0, 8)));
  const sel = $("#actor-select");
  for (const p of run.players) {
    const o = document.createElement("option");
    o.value = p.id;
    sel.appendChild(o);
  }
  sel.value = actor;
}

function render() {
  if (document.activeElement !== $("#run-name")) $("#run-name").textContent = run.name;
  if (document.activeElement !== $("#run-game")) $("#run-game").textContent = run.game;
  document.title = `${run.name} · Nuzlocke Tracker`;
  const sel = $("#actor-select");
  for (const p of run.players) {
    const o = sel.querySelector(`option[value="${p.id}"]`);
    if (o) o.textContent = p.name;
  }
  renderPlayers();
  renderGrid();
  renderGraveyard();
  renderRuns();
  renderBadges();
  renderStats();
  renderOnline();
  if (!$("#type-picker").children.length) renderTypeLookup();
}

function renderOnline() {
  if (!run) return;
  $("#online").innerHTML = run.players
    .map(
      (p) =>
        `<span class="dot ${online.includes(p.id) ? "on" : ""}" style="--c:${p.color}" title="${esc(p.name)} ${
          online.includes(p.id) ? "online" : "offline"
        }"></span>`
    )
    .join("");
}

function renderPlayers() {
  $("#players").innerHTML = run.players
    .map((p) => {
      const encs = encountersOf(p.id);
      const alive = encs.filter((x) => x.e.status === "alive" || x.e.status === "boxed");
      const dead = encs.filter((x) => x.e.status === "dead");
      const resets = (run.history || []).filter((a) => a.resetBy === p.id).length;
      return `<article class="player ${actor === p.id ? "me" : ""}" style="--c:${p.color}">
        <button class="avatar ${p.sprite ? "" : "empty"}" data-pick-sprite="${p.id}" title="Choose trainer sprite">
          ${p.sprite ? `<img src="${TRAINER(p.sprite)}" alt="" />` : "?"}
        </button>
        <div class="player-body">
          <header>
            <span class="pname" contenteditable="true" spellcheck="false" data-pid="${p.id}">${esc(p.name)}</span>
          </header>
        <footer>
          <span class="pill alive">${alive.length} alive</span>
          <span class="pill dead">${dead.length} dead</span>
          <span class="pill reset" title="Runs this player reset">${resets} reset${resets === 1 ? "" : "s"}</span>
        </footer>
        </div>
      </article>`;
    })
    .join("");
}

function cellHtml(route, p) {
  const e = run.encounters[route.id]?.[p.id];
  if (!e || (!e.species && e.status === "none")) {
    return `<td class="cell empty" data-route="${route.id}" data-pid="${p.id}"><span class="plus">+</span></td>`;
  }
  if (e.status === "missed" && !e.species) {
    return `<td class="cell missed" data-route="${route.id}" data-pid="${p.id}"><span class="missed-label">Missed</span></td>`;
  }
  const d = e.dexId || dexByLabel(e.species)?.id;
  const status = e.status === "boxed" ? "alive" : e.status;
  const title = (e.nickname ? `${e.nickname} (${e.species})` : e.species) + (status === "dead" ? " – dead" : "");
  return `<td class="cell ${status}" data-route="${route.id}" data-pid="${p.id}" title="${esc(title)}">
    ${d ? `<img class="sprite" src="${SPRITE(d)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
    <span class="species">${esc(e.nickname || e.species)}</span>
  </td>`;
}

// Size the card to the remaining viewport height so the page never scrolls; the card scrolls instead.
function fitGridHeight() {
  const wrap = $("#grid-wrap");
  const top = wrap.getBoundingClientRect().top;
  wrap.style.height = Math.max(200, window.innerHeight - top - 16) + "px";
}

function renderGrid() {
  const wrap = $("#grid-wrap");
  const scrollTop = wrap.scrollTop;
  if (!run.routes.length) {
    wrap.innerHTML = `<p class="muted center">No routes yet – add one above.</p>`;
    fitGridHeight();
    return;
  }
  const head = `<thead><tr><th class="route-h">Location</th>${run.players
    .map((p) => `<th style="--c:${p.color}" title="${esc(p.name)}"><span class="swatch"></span>${esc(p.name)}</th>`)
    .join("")}</tr></thead>`;
  const rows = run.routes
    .map(
      (r, i) => `<tr data-route="${r.id}" data-index="${i}" class="${r.wipe ? "wiped" : ""}" style="--wipe-c:${
        player(r.wipe?.by)?.color || "var(--dead)"
      }">
        <th class="route" data-route="${r.id}" draggable="true">
          <span class="drag-handle" aria-hidden="true">⋮⋮</span>
          <span class="route-name" title="${esc(r.name)} – drag to reorder, double-click to rename">${esc(r.name)}</span>
          <span class="route-tools">
            <button data-remove="${r.id}" title="Remove route" class="danger">×</button>
            <label class="wipe ${r.wipe ? "on" : ""}" title="${
              r.wipe ? `Marked dead by ${esc(r.wipe.byName)} · ${new Date(r.wipe.at).toLocaleString()}` : "Check if everyone's Pokémon from this route died"
            }">
              <input type="checkbox" data-wipe="${r.id}" ${r.wipe ? "checked" : ""} />
              ${r.wipe ? `<span class="wipe-by">${esc(r.wipe.byName)}</span>` : ""}
            </label>
          </span>
        </th>
        ${run.players.map((p) => cellHtml(r, p)).join("")}
      </tr>`
    )
    .join("");
  wrap.innerHTML = `<table class="grid">${head}<tbody>${rows}</tbody></table>`;
  fitGridHeight();
  wrap.scrollTop = scrollTop;
}

function renderGraveyard() {
  $("#graveyard").innerHTML = run.players
    .map((p) => {
      const dead = encountersOf(p.id).filter((x) => x.e.status === "dead");
      return `<section class="grave-col" style="--c:${p.color}">
        <h3>${esc(p.name)} <small>${dead.length} fallen</small></h3>
        ${
          dead.length
            ? dead
                .map(
                  (x) => `<div class="tomb">
              ${x.e.dexId ? `<img src="${SPRITE(x.e.dexId)}" alt="" onerror="this.remove()" />` : ""}
              <div>
                <strong>${esc(x.e.nickname || x.e.species)}</strong>
                <div class="muted">${esc(x.e.nickname ? x.e.species + " · " : "")}${esc(x.route.name)}</div>
              </div>
            </div>`
                )
                .join("")
            : '<p class="muted">No deaths yet. Keep it that way.</p>'
        }
      </section>`;
    })
    .join("");
}

const currentAttempt = () => (run.history || []).length + 1;

function renderRuns() {
  const history = run.history || [];
  const current = currentAttempt();
  $("#attempt-big").innerHTML = `<span>Attempt</span> #${current}`;
  if (!history.length) {
    $("#runs").innerHTML = `<p class="muted">No lost runs yet. Attempt #${current} is in progress.</p>`;
    return;
  }
  $("#runs").innerHTML = [...history]
    .reverse()
    .map((a) => {
      const ended = new Date(a.endedAt);
      const resetter = a.players.find((p) => p.id === a.resetBy);
      const cols = a.players
        .map((p) => {
          const encs = a.routes
            .map((r) => ({ route: r, e: a.encounters[r.id]?.[p.id] }))
            .filter((x) => x.e && x.e.species);
          const dead = encs.filter((x) => x.e.status === "dead");
          const alive = encs.filter((x) => x.e.status !== "dead");
          const sprites = encs
            .map(
              (x) => `<img class="${x.e.status === "dead" ? "dead" : ""}" src="${x.e.dexId ? SPRITE(x.e.dexId) : ""}" alt="" title="${esc(
                (x.e.nickname ? x.e.nickname + " · " : "") + x.e.species + " · " + x.route.name + (x.e.status === "dead" ? " (dead)" : "")
              )}" onerror="this.remove()" />`
            )
            .join("");
          return `<div class="run-player" style="--c:${p.color}">
            <strong>${esc(p.name)}</strong>
            <div class="run-sprites">${sprites || '<span class="muted">—</span>'}</div>
            <div><span class="pill alive">${alive.length} alive</span> <span class="pill dead">${dead.length} dead</span></div>
          </div>`;
        })
        .join("");
      return `<article class="run-card">
        <header>
          <h3>Attempt #${a.number}</h3>
          <span class="muted">${a.badges || 0} badge${a.badges === 1 ? "" : "s"} · Ended ${ended.toLocaleString()} · reset by
            <span class="swatch" style="--c:${resetter?.color || "#888"}"></span><strong>${esc(a.resetByName || resetter?.name || "Unknown")}</strong>
          </span>
          <button class="danger small" data-delete-attempt="${a.id}" title="Delete this archived attempt">Delete</button>
        </header>
        ${a.reason ? `<p class="run-reason">“${esc(a.reason)}”</p>` : ""}
        <div class="run-players">${cols}</div>
      </article>`;
    })
    .join("");
}

function renderBadges() {
  const b = run.badges || 0;
  $("#badge-row").innerHTML = BADGES.map(
    (bd, i) =>
      `<button type="button" class="badge ${i < b ? "got" : ""}" data-badge="${i + 1}" title="${esc(bd.name)}${i < b ? " ✓" : ""}">${badgeSvg(i)}</button>`
  ).join("");
}

// ---------- Stats ----------
// Every attempt so far: archived ones plus the one in progress.
function allAttempts() {
  const current = {
    number: currentAttempt(),
    routes: run.routes,
    encounters: run.encounters,
    badges: run.badges || 0,
    resetBy: null,
    current: true,
  };
  return [...(run.history || []).map((a) => ({ ...a, badges: a.badges || 0 })), current];
}

// Deaths "caused" by a player = Pokémon that died in rows that player marked as wiped.
function deathsCausedBy(attempt) {
  const out = {};
  for (const r of attempt.routes) {
    if (!r.wipe?.by) continue;
    const row = attempt.encounters[r.id] || {};
    const n = Object.values(row).filter((e) => e.species && e.status === "dead").length;
    out[r.wipe.by] = (out[r.wipe.by] || 0) + n;
  }
  return out;
}

function renderStats() {
  const attempts = allAttempts();
  const runsCount = attempts.length;
  const totals = {};
  for (const a of attempts) for (const [pid, n] of Object.entries(deathsCausedBy(a))) totals[pid] = (totals[pid] || 0) + n;
  const resets = {};
  for (const a of run.history || []) if (a.resetBy) resets[a.resetBy] = (resets[a.resetBy] || 0) + 1;

  const rows = run.players.map((p) => ({
    p,
    caused: totals[p.id] || 0,
    avg: (totals[p.id] || 0) / runsCount,
    resets: resets[p.id] || 0,
  }));
  const maxResets = Math.max(0, ...rows.map((r) => r.resets));
  const wipers = maxResets > 0 ? rows.filter((r) => r.resets === maxResets) : [];
  const furthest = attempts.reduce((best, a) => (!best || a.badges > best.badges ? a : best), null);

  const pname = (p) => `<span class="swatch" style="--c:${p.color}"></span>${esc(p.name)}`;
  $("#stats").innerHTML = `
    <div class="stat-cards">
      <article class="stat-card">
        <h4>Most likely to wipe</h4>
        <div class="stat-big">${wipers.length ? wipers.map((r) => pname(r.p)).join(" / ") : '<span class="muted">No resets yet</span>'}</div>
        <div class="muted">${maxResets ? `${maxResets} reset${maxResets === 1 ? "" : "s"}` : ""}</div>
      </article>
      <article class="stat-card">
        <h4>Furthest run</h4>
        <div class="stat-big">${furthest ? `Attempt #${furthest.number}${furthest.current ? " (current)" : ""}` : "—"}</div>
        <div class="muted">${furthest ? `${furthest.badges} badge${furthest.badges === 1 ? "" : "s"}` : ""}</div>
      </article>
      <article class="stat-card">
        <h4>Attempts</h4>
        <div class="stat-big">${runsCount}</div>
        <div class="muted">${(run.history || []).length} lost · 1 in progress</div>
      </article>
    </div>
    <table class="stat-table">
      <thead><tr><th>Player</th><th>All-time deaths caused</th><th>Avg deaths caused / run</th><th>Resets</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td>${pname(r.p)}</td>
              <td>${r.caused}</td>
              <td>${r.avg.toFixed(1)}</td>
              <td>${r.resets}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <p class="hint">"Deaths caused" counts every Pokémon that died in a route row the player marked as wiped (the checkbox next to a route).</p>`;
}

// ---------- Type lookup ----------
let pickedTypes = [];
function renderTypePicker() {
  $("#type-picker").innerHTML = TYPE_CHART.types
    .map(
      (t) =>
        `<button type="button" class="type-tag${pickedTypes.includes(t) ? " on" : ""}" data-type="${t}" style="--tc:${TYPE_COLORS[t]}">${t}</button>`
    )
    .join("");
}
function renderTypeLookup() {
  renderTypePicker();
  const out = $("#type-result");
  if (!pickedTypes.length) {
    out.innerHTML = `<p class="hint">Pick one or two types to see their matchups.</p>`;
    return;
  }
  const g = matchupsFor(pickedTypes);
  const stab = TYPE_CHART.types.filter((def) => pickedTypes.some((atk) => effectiveness(TYPE_CHART, atk, def) === 2));
  const best = (def) => Math.max(...pickedTypes.map((atk) => effectiveness(TYPE_CHART, atk, def)));
  const nve = TYPE_CHART.types.filter((def) => best(def) === 0.5);
  const noEffect = TYPE_CHART.types.filter((def) => best(def) === 0);
  out.innerHTML = `
    <div class="lookup-head">
      <div>
        <h3>${pickedTypes.join(" / ")}</h3>
        <div class="mu-types">${pickedTypes.map(typeTag).join("")}</div>
      </div>
    </div>
    <div class="mu-cols">
      <div class="mu-col">
        <h5>Defending</h5>
        ${matchupBlock("Weak", "w4", "4×", g[4])}
        ${matchupBlock("Weak", "w2", "2×", g[2])}
        ${matchupBlock("Resists", "r2", "½×", g[0.5])}
        ${matchupBlock("Resists", "r4", "¼×", g[0.25])}
        ${matchupBlock("Immune", "im", "0×", g[0])}
      </div>
      <div class="mu-col">
        <h5>Attacking</h5>
        ${matchupBlock("Super effective against", "se", "2×", stab) || `<p class="hint">No super-effective targets.</p>`}
        ${matchupBlock("Not very effective against", "w2", "½×", nve)}
        ${matchupBlock("No effect on", "im", "0×", noEffect)}
      </div>
    </div>`;
}
$("#type-picker").addEventListener("click", (e) => {
  const b = e.target.closest("[data-type]");
  if (!b) return;
  const t = b.dataset.type;
  if (pickedTypes.includes(t)) pickedTypes = pickedTypes.filter((x) => x !== t);
  else pickedTypes = [...pickedTypes, t].slice(-2);
  renderTypeLookup();
});

// ---------- Pokémon lookup ----------
const typeCache = JSON.parse(localStorage.getItem("nuz:types:v1") || "{}");
async function fetchTypes(id) {
  if (typeCache[id]) return typeCache[id];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error("not found");
  const json = await res.json();
  const types = json.types.sort((a, b) => a.slot - b.slot).map((t) => titleCase(t.type.name));
  typeCache[id] = types;
  localStorage.setItem("nuz:types:v1", JSON.stringify(typeCache));
  return types;
}
function typeTag(t) {
  return `<span class="type-tag" style="--tc:${TYPE_COLORS[t] || "#888"}">${t}</span>`;
}
function matchupsFor(defTypes) {
  const groups = { 4: [], 2: [], 0.5: [], 0.25: [], 0: [] };
  for (const atk of TYPE_CHART.types) {
    const m = defTypes.reduce((acc, d) => acc * effectiveness(TYPE_CHART, atk, d), 1);
    if (groups[m]) groups[m].push(atk);
  }
  return groups;
}
function matchupBlock(title, cls, label, types) {
  if (!types.length) return "";
  return `<div class="mu ${cls}"><h4><b>${label}</b> ${title}</h4><div class="mu-types">${types.map(typeTag).join("")}</div></div>`;
}
let lookupSeq = 0;
async function showLookup(d) {
  const seq = ++lookupSeq;
  const out = $("#lk-result");
  out.innerHTML = `<div class="lookup-head"><img src="${SPRITE(d.id)}" alt="" /><div><h3>${esc(d.label)} <small>#${d.id}</small></h3><p class="hint">Loading types…</p></div></div>`;
  let types;
  try {
    types = await fetchTypes(d.id);
  } catch {
    if (seq === lookupSeq) out.querySelector(".hint").textContent = "Couldn't load type data (offline?).";
    return;
  }
  if (seq !== lookupSeq) return;
  const g = matchupsFor(types);
  // Offensive: what this Pokémon's STAB types hit super-effectively
  const stab = TYPE_CHART.types.filter((def) => types.some((atk) => effectiveness(TYPE_CHART, atk, def) === 2));
  out.innerHTML = `
    <div class="lookup-head">
      <img src="${SPRITE(d.id)}" alt="" />
      <div>
        <h3>${esc(d.label)} <small>#${d.id}</small></h3>
        <div class="mu-types">${types.map(typeTag).join("")}</div>
      </div>
    </div>
    <div class="mu-cols">
      <div class="mu-col">
        <h5>Defending</h5>
        ${matchupBlock("Weak", "w4", "4×", g[4])}
        ${matchupBlock("Weak", "w2", "2×", g[2])}
        ${matchupBlock("Resists", "r2", "½×", g[0.5])}
        ${matchupBlock("Resists", "r4", "¼×", g[0.25])}
        ${matchupBlock("Immune", "im", "0×", g[0])}
      </div>
      <div class="mu-col">
        <h5>Attacking (STAB)</h5>
        ${matchupBlock("Super effective against", "se", "2×", stab) || `<p class="hint">No super-effective STAB targets.</p>`}
      </div>
    </div>`;
}
$("#lk-species").addEventListener("input", () => {
  const q = $("#lk-species").value.trim().toLowerCase();
  const ul = $("#lk-suggest");
  if (!q) return (ul.hidden = true);
  const hits = dex.filter((d) => d.label.toLowerCase().startsWith(q)).slice(0, 8);
  const more = hits.length < 8 ? dex.filter((d) => !hits.includes(d) && d.label.toLowerCase().includes(q)).slice(0, 8 - hits.length) : [];
  const all = [...hits, ...more];
  ul.innerHTML = all
    .map((d) => `<li data-id="${d.id}"><img src="${SPRITE(d.id)}" alt="" loading="lazy" /> ${esc(d.label)} <small>#${d.id}</small></li>`)
    .join("");
  ul.hidden = all.length === 0;
});
function pickLookup(li) {
  const d = dex.find((x) => x.id === Number(li.dataset.id));
  if (!d) return;
  $("#lk-species").value = d.label;
  $("#lk-suggest").hidden = true;
  showLookup(d);
}
$("#lk-suggest").addEventListener("mousedown", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  e.preventDefault();
  pickLookup(li);
});
$("#lk-species").addEventListener("blur", () => setTimeout(() => ($("#lk-suggest").hidden = true), 100));
$("#lk-species").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = $("#lk-suggest li");
    if (first && !$("#lk-suggest").hidden) pickLookup(first);
    else {
      const d = dexByLabel($("#lk-species").value.trim());
      if (d) showLookup(d);
    }
  }
});

function flashRemote(pid) {
  const p = player(pid);
  if (!p) return;
  const el = $("#online");
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

let toastTimer;
function toast(text, bad = false) {
  const el = $("#toast");
  el.textContent = text;
  el.className = "toast " + (bad ? "bad" : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2500);
}

// ---------- Encounter dialog ----------
const dlg = $("#enc-dialog");
let editing = null; // {routeId, pid}

function openEncounter(routeId, pid) {
  const r = run.routes.find((x) => x.id === routeId);
  const p = player(pid);
  if (!r || !p) return;
  editing = { routeId, pid };
  const e = run.encounters[routeId]?.[pid] || {};
  $("#enc-title").innerHTML = `${esc(r.name)} <small style="color:${p.color}">${esc(p.name)}</small>`;
  $("#enc-species").value = e.species || "";
  $("#enc-nick").value = e.nickname || "";
  const status = e.status && e.status !== "none" && e.status !== "boxed" ? e.status : "alive";
  $(`#enc-form input[name=status][value=${status}]`).checked = true;
  updateSprite();
  $("#enc-suggest").hidden = true;
  dlg.showModal();
  $("#enc-species").focus();
}

function updateSprite() {
  const d = dexByLabel($("#enc-species").value);
  const img = $("#enc-sprite");
  if (d) {
    img.src = SPRITE(d.id);
    img.style.visibility = "visible";
  } else img.style.visibility = "hidden";
}

$("#enc-species").addEventListener("input", () => {
  const q = $("#enc-species").value.trim().toLowerCase();
  const ul = $("#enc-suggest");
  updateSprite();
  if (!q) return (ul.hidden = true);
  const hits = dex.filter((d) => d.label.toLowerCase().startsWith(q)).slice(0, 8);
  const more = hits.length < 8 ? dex.filter((d) => !hits.includes(d) && d.label.toLowerCase().includes(q)).slice(0, 8 - hits.length) : [];
  const all = [...hits, ...more];
  ul.innerHTML = all
    .map((d) => `<li data-label="${esc(d.label)}"><img src="${SPRITE(d.id)}" alt="" loading="lazy" /> ${esc(d.label)} <small>#${d.id}</small></li>`)
    .join("");
  ul.hidden = all.length === 0;
});
$("#enc-suggest").addEventListener("mousedown", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  e.preventDefault();
  $("#enc-species").value = li.dataset.label;
  $("#enc-suggest").hidden = true;
  updateSprite();
  $("#enc-nick").focus();
});
$("#enc-species").addEventListener("blur", () => setTimeout(() => ($("#enc-suggest").hidden = true), 100));
$("#enc-species").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("#enc-suggest").hidden) {
    e.preventDefault();
    const first = $("#enc-suggest li");
    if (first) {
      $("#enc-species").value = first.dataset.label;
      $("#enc-suggest").hidden = true;
      updateSprite();
    }
  }
});

$("#enc-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!editing) return;
  const species = $("#enc-species").value.trim();
  const status = $("#enc-form input[name=status]:checked")?.value || "alive";
  if (!species && status !== "missed") return toast("Enter a species or mark as missed", true);
  const d = dexByLabel(species);
  send({
    type: "setEncounter",
    routeId: editing.routeId,
    playerId: editing.pid,
    encounter: {
      species: d ? d.label : species,
      dexId: d?.id || null,
      nickname: $("#enc-nick").value,
      status,
    },
  });
  dlg.close();
});
$("#enc-cancel").addEventListener("click", () => dlg.close());
$("#enc-clear").addEventListener("click", () => {
  if (!editing) return;
  send({ type: "setEncounter", routeId: editing.routeId, playerId: editing.pid, encounter: { status: "none" } });
  dlg.close();
});

// ---------- Event wiring ----------
$("#grid-wrap").addEventListener("change", (e) => {
  const cb = e.target.closest("input[data-wipe]");
  if (!cb) return;
  if (!actor) {
    cb.checked = !cb.checked;
    return toast("Choose who you are (top right) first", true);
  }
  send({ type: "setRouteWipe", routeId: cb.dataset.wipe, wiped: cb.checked });
});
$("#grid-wrap").addEventListener("click", (e) => {
  if (e.target.closest(".wipe")) return;
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const r = run.routes.find((x) => x.id === rm.dataset.remove);
    if (confirm(`Remove "${r?.name}" and all its encounters?`)) send({ type: "removeRoute", routeId: rm.dataset.remove });
    return;
  }
  const cell = e.target.closest("td.cell");
  if (cell) openEncounter(cell.dataset.route, cell.dataset.pid);
});
$("#grid-wrap").addEventListener("dblclick", (e) => {
  const th = e.target.closest("th.route");
  if (!th || e.target.closest(".wipe")) return;
  const r = run.routes.find((x) => x.id === th.dataset.route);
  const name = prompt("Rename route", r.name);
  if (name && name.trim() && name.trim() !== r.name) send({ type: "renameRoute", routeId: r.id, name: name.trim() });
});

// Drag-and-drop route reordering
let dragRouteId = null;
const gridWrap = $("#grid-wrap");
gridWrap.addEventListener("dragstart", (e) => {
  const th = e.target.closest("th.route");
  if (!th || e.target.closest(".wipe")) return e.preventDefault();
  dragRouteId = th.dataset.route;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragRouteId);
  th.closest("tr").classList.add("dragging");
});
gridWrap.addEventListener("dragover", (e) => {
  if (!dragRouteId) return;
  const tr = e.target.closest("tr[data-route]");
  if (!tr) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const rect = tr.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  gridWrap.querySelectorAll(".drop-before, .drop-after").forEach((el) => el.classList.remove("drop-before", "drop-after"));
  if (tr.dataset.route !== dragRouteId) tr.classList.add(after ? "drop-after" : "drop-before");
});
gridWrap.addEventListener("drop", (e) => {
  if (!dragRouteId) return;
  const tr = e.target.closest("tr[data-route]");
  if (!tr) return;
  e.preventDefault();
  const from = run.routes.findIndex((r) => r.id === dragRouteId);
  let to = Number(tr.dataset.index);
  const rect = tr.getBoundingClientRect();
  if (e.clientY > rect.top + rect.height / 2) to += 1;
  if (from < to) to -= 1; // account for removal of the dragged item
  if (to !== from && tr.dataset.route !== dragRouteId) send({ type: "reorderRoute", routeId: dragRouteId, toIndex: to });
});
gridWrap.addEventListener("dragend", () => {
  dragRouteId = null;
  gridWrap.querySelectorAll(".dragging, .drop-before, .drop-after").forEach((el) => el.classList.remove("dragging", "drop-before", "drop-after"));
});

$("#add-route").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = e.target.elements.name;
  send({ type: "addRoutes", names: [input.value], prepend: true });
  input.value = "";
  $("#grid-wrap").scrollTop = 0;
});
// ---------- Trainer sprite picker ----------
const spriteDlg = $("#sprite-dialog");
let pickingFor = null;
$("#players").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pick-sprite]");
  if (!b) return;
  pickingFor = b.dataset.pickSprite;
  const p = player(pickingFor);
  $("#sprite-title").innerHTML = `Trainer sprite <small style="color:${p.color}">${esc(p.name)}</small>`;
  $("#sprite-grid").innerHTML = `<div class="sprite-row">${TRAINERS.flatMap((g) => g.list)
    .map(
      ([id, label]) =>
        `<button type="button" class="sprite-opt ${p.sprite === id ? "selected" : ""}" data-sprite="${id}" title="${esc(label)}">
          <img src="${TRAINER(id)}" alt="${esc(label)}" loading="lazy" /><span>${esc(label)}</span>
        </button>`
    )
    .join("")}</div>`;
  spriteDlg.showModal();
});
$("#sprite-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sprite]");
  if (!b || !pickingFor) return;
  send({ type: "setPlayer", playerId: pickingFor, sprite: b.dataset.sprite });
  spriteDlg.close();
});
$("#sprite-cancel").addEventListener("click", () => spriteDlg.close());

$("#badge-row").addEventListener("click", (e) => {
  const b = e.target.closest("[data-badge]");
  if (!b) return;
  const n = Number(b.dataset.badge);
  // Clicking the last earned badge un-earns it; otherwise set the count to that badge.
  send({ type: "setBadges", badges: n === (run.badges || 0) ? n - 1 : n });
});

const resetDlg = $("#reset-dialog");
$("#reset-run").addEventListener("click", () => {
  if (!actor) return toast("Choose who you are (top right) before resetting", true);
  $("#reset-attempt").textContent = `#${currentAttempt()}`;
  $("#reset-reason").value = "";
  resetDlg.showModal();
  $("#reset-reason").focus();
});
$("#reset-cancel").addEventListener("click", () => resetDlg.close());
$("#reset-form").addEventListener("submit", (e) => {
  e.preventDefault();
  send({ type: "resetRun", reason: $("#reset-reason").value.trim() });
  resetDlg.close();
});
$("#runs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-delete-attempt]");
  if (!b) return;
  const a = (run.history || []).find((x) => x.id === b.dataset.deleteAttempt);
  if (a && confirm(`Delete archived attempt #${a.number}? This cannot be undone.`)) {
    send({ type: "deleteAttempt", attemptId: a.id });
  }
});
$("#players").addEventListener(
  "blur",
  (e) => {
    const el = e.target.closest?.(".pname");
    if (!el) return;
    const name = el.textContent.trim();
    if (name && name !== player(el.dataset.pid).name) send({ type: "setPlayer", playerId: el.dataset.pid, name });
    else el.textContent = player(el.dataset.pid).name;
  },
  true
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[contenteditable]")) {
    e.preventDefault();
    e.target.blur();
  }
});
$("#run-name").addEventListener("blur", (e) => {
  const name = e.target.textContent.trim();
  if (name && name !== run.name) send({ type: "setMeta", name });
  else e.target.textContent = run.name;
});
$("#run-game").addEventListener("blur", (e) => {
  const game = e.target.textContent.trim();
  if (game && game !== run.game) send({ type: "setMeta", game });
  else e.target.textContent = run.game;
});
$("#actor-select").addEventListener("change", (e) => {
  actor = e.target.value;
  localStorage.setItem(`nuz:actor:${runId}`, actor);
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "identify", actor }));
  renderPlayers();
});

$("#copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Invite link copied");
  } catch {
    prompt("Copy this link", location.href);
  }
});

document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === `tab-${b.dataset.tab}`));
    if (b.dataset.tab === "encounters" && run) fitGridHeight();
    if (b.dataset.tab === "lookup") $("#lk-species").focus();
  })
);

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => run && fitGridHeight(), 60);
});

// ---------- boot ----------
loadDex().finally(connect);
