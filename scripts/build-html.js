// Assembles public/*.html from the view partials.
//
// Pages live in views/pages/; every other .html under views/ is the
// markup for the controller of the same name (public/js/controllers/). Any line of the form
//   <!-- @include path/to/partial.html -->
// is replaced with that file's contents (resolved relative to the including file,
// indented to match).

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../views/pages/", import.meta.url));
const OUT = fileURLToPath(new URL("../public/", import.meta.url));
const INCLUDE = /^([ \t]*)<!--\s*@include\s+(\S+)\s*-->[ \t]*$/gm;

async function render(file, seen = []) {
  if (seen.includes(file)) throw new Error(`Circular include: ${[...seen, file].join(" → ")}`);
  const html = await readFile(file, "utf8");
  const parts = [];
  let last = 0;
  for (const match of html.matchAll(INCLUDE)) {
    const [directive, indent, target] = match;
    const included = await render(path.resolve(path.dirname(file), target), [...seen, file]);
    parts.push(html.slice(last, match.index), indentLines(included.trimEnd(), indent));
    last = match.index + directive.length;
  }
  parts.push(html.slice(last));
  return parts.join("");
}

const indentLines = (text, indent) => text.replace(/^(?=.)/gm, indent);

await mkdir(OUT, { recursive: true });
const pages = (await readdir(SRC, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".html"));
for (const page of pages) {
  await writeFile(path.join(OUT, page.name), await render(path.join(SRC, page.name)));
  console.log(`built public/${page.name}`);
}
