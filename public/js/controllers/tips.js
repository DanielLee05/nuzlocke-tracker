// Tips tab (views/tips.html): expand / collapse. Each .expand-button toggles the
// element named in its aria-controls attribute. The + / − lives in .expand-icon.

import { $$ } from "../lib/dom.js";

export function initTips() {
  for (const button of $$(".expand-button")) {
    const content = document.getElementById(button.getAttribute("aria-controls"));
    if (!content) continue;

    button.addEventListener("click", () => {
      const expanded = button.ariaExpanded !== "true";
      button.ariaExpanded = String(expanded);
      content.hidden = !expanded;
      const icon = button.querySelector(".expand-icon");
      if (icon) icon.textContent = expanded ? "−" : "+";
    });
  }
}
