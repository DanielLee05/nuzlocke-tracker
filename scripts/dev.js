// Local development: rebuild HTML when views/ change, rebuild CSS when src/ changes,
// and restart the server when server code changes. If any process exits, stop them all
// so a failure (e.g. port already in use) is never hidden.

import { spawn } from "node:child_process";

const tasks = {
  html: ["node", ["--watch-path=views", "scripts/build-html.js"]],
  css: ["npx", ["tailwindcss", "-i", "src/app.css", "-o", "public/app.css", "--watch"]],
  server: ["node", ["--watch", "server.js"]],
};

const children = Object.entries(tasks).map(([name, [cmd, args]]) => {
  // stdin stays open on purpose: tailwind --watch quits as soon as its stdin ends.
  const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
  const prefix = (chunk) => chunk.toString().replace(/^(?=.)/gm, `[${name}] `);
  child.stdout.on("data", (c) => process.stdout.write(prefix(c)));
  child.stderr.on("data", (c) => process.stderr.write(prefix(c)));
  child.on("exit", (code) => {
    console.error(`[dev] ${name} exited with code ${code} – stopping everything`);
    shutdown(code ?? 1);
  });
  return child;
});

function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
