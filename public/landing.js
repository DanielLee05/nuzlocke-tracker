const recentKey = "nuz:recent";
let recent = JSON.parse(localStorage.getItem(recentKey) || "[]");

function renderRecent() {
  const el = document.getElementById("recent");
  if (!recent.length) return (el.innerHTML = "");
  el.innerHTML =
    `<h3>Recent runs</h3><ul class="recent-list">` +
    recent
      .map(
        (r) =>
          `<li><a href="/run/${r.id}"><strong>${esc(r.name)}</strong> <code>${r.id}</code></a>` +
          `<button type="button" class="recent-remove" data-remove="${r.id}" title="Remove from recent runs" aria-label="Remove ${esc(r.name)} from recent runs">×</button></li>`
      )
      .join("") +
    `</ul>`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
renderRecent();

document.getElementById("recent").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (!btn) return;
  e.preventDefault();
  recent = recent.filter((r) => r.id !== btn.dataset.remove);
  localStorage.setItem(recentKey, JSON.stringify(recent));
  renderRecent();
});

document.getElementById("create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = {
    name: fd.get("name"),
    game: "Emerald",
    players: [fd.get("p1"), fd.get("p2"), fd.get("p3"), fd.get("p4")],
    routes: window.ROUTE_PRESETS.hoenn,
  };
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const run = await res.json();
    location.href = `/run/${run.id}`;
  } catch (err) {
    alert("Could not create run: " + err.message);
    btn.disabled = false;
  }
});

document.getElementById("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = new FormData(e.target).get("code").trim().toUpperCase();
  if (code) location.href = `/run/${code}`;
});
