import { startApp } from "./core/app.js";
import { registerGame } from "./core/registry.js";
import { robotMaze } from "./games/robot-maze/index.js";

registerGame(robotMaze);

startApp(
  /** @type {HTMLElement} */ (document.getElementById("header")),
  /** @type {HTMLElement} */ (document.getElementById("app")),
);
