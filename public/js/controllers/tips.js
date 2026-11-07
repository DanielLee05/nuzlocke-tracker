// Tips tab (views/tips.html): expand / collapse. Each .expand-button toggles the
// element named in its aria-controls attribute. Height / fade / +→× are CSS.

import { $$ } from "../lib/dom.js";

export function initTips() {
  for (const button of $$(".expand-button")) {
    const content = document.getElementById(button.getAttribute("aria-controls"));
    if (!content) continue;
    content.inert = button.ariaExpanded !== "true";

    button.addEventListener("click", () => {
      const expanded = button.ariaExpanded !== "true";
      button.ariaExpanded = String(expanded);
      content.inert = !expanded;
    });
  }
}
