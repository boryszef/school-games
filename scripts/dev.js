// Runs the game against a local Worker and database, for manual testing (R1.6).
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { REPO, WRANGLER, WRANGLER_CONFIG, applyLocalMigrations } from "./local-db.js";

const SITE_PORT = 8000;
const WORKER_PORT = 8787;

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net !== undefined && net.family === "IPv4" && !net.internal)
  .map((net) => /** @type {import("node:os").NetworkInterfaceInfo} */ (net).address);
const hosts = ["localhost", "127.0.0.1", ...lanAddresses];
const origins = hosts.map((host) => `http://${host}:${SITE_PORT}`);

applyLocalMigrations();

const children = [
  {
    name: "static server",
    // It logs every request on stderr; the browser's network tab shows the same.
    process: spawn("python3", ["-m", "http.server", String(SITE_PORT), "--bind", "0.0.0.0"], {
      cwd: REPO,
      stdio: "ignore",
    }),
  },
  {
    name: "local Worker",
    process: spawn(
      WRANGLER,
      [
        "dev",
        "--config",
        WRANGLER_CONFIG,
        "--ip",
        "0.0.0.0",
        "--port",
        String(WORKER_PORT),
        "--var",
        `DEV_ORIGINS:${origins.join(",")}`,
      ],
      { cwd: REPO, stdio: "inherit" },
    ),
  },
];

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.process.kill("SIGTERM");
}
for (const child of children) {
  child.process.on("exit", (code, signal) => {
    if (!stopping) console.error(`\n${child.name} stopped (${signal ?? `exit ${code}`})`);
    stopAll();
  });
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

console.log(`
Local game, local Worker and local database; production is not used.
  This computer:  http://localhost:${SITE_PORT}/
${lanAddresses.map((ip) => `  Phone on Wi-Fi: http://${ip}:${SITE_PORT}/`).join("\n")}
Press Ctrl+C to stop.
`);
