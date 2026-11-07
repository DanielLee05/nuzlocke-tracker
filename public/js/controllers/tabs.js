// Tab strip (views/tabs.html): buttons with data-tab toggle <section id="tab-…" role="tabpanel">.

import { $$ } from "../lib/dom.js";

/** onShow(name) runs after a tab becomes visible (e.g. to re-measure or focus). */
export function initTabs({ onShow }) {
  for (const button of $$("[role=tab]")) {
    button.addEventListener("click", () => {
      showTab(button.dataset.tab);
      onShow(button.dataset.tab);
    });
  }
}

export function showTab(name) {
  for (const button of $$("[role=tab]")) button.ariaSelected = String(button.dataset.tab === name);
  for (const panel of $$("[role=tabpanel]")) panel.hidden = panel.id !== `tab-${name}`;
}

export const isTabVisible = (name) => !document.getElementById(`tab-${name}`).hidden;
