// Wipes the local database (players, runs, wins) that `npm run dev` uses; production is untouched.
import { rmSync } from "node:fs";
import { createConnection } from "node:net";
import { LOCAL_DB_DIR, applyLocalMigrations } from "./local-db.js";

const WORKER_PORT = 8787;

const running = await new Promise((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port: WORKER_PORT });
  socket.on("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.on("error", () => resolve(false));
});
if (running) {
  console.error(`Something is listening on port ${WORKER_PORT}: stop npm run dev first.`);
  process.exit(1);
}

rmSync(LOCAL_DB_DIR, { recursive: true, force: true });
console.log(`Deleted ${LOCAL_DB_DIR}`);
applyLocalMigrations();
