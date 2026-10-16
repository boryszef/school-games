import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO = fileURLToPath(new URL("..", import.meta.url));
export const WRANGLER = fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url));
export const WRANGLER_CONFIG = "worker/wrangler.jsonc";
/** Where `wrangler dev` keeps the local D1 database. */
export const LOCAL_DB_DIR = fileURLToPath(
  new URL("../worker/.wrangler/state/v3/d1", import.meta.url),
);

/** Brings the local database (never the remote one) up to the latest migration. */
export function applyLocalMigrations() {
  const result = spawnSync(
    WRANGLER,
    ["d1", "migrations", "apply", "school-games", "--local", "--config", WRANGLER_CONFIG],
    // CI=1 stops wrangler from asking for confirmation.
    { cwd: REPO, stdio: "inherit", env: { ...process.env, CI: "1" } },
  );
  if (result.status !== 0) throw new Error(`local migrations failed (exit ${result.status})`);
}
