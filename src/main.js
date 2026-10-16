import { startApp } from "./core/app.js";
import { registerGame } from "./core/registry.js";
import { robotMaze, robotMazeHard } from "./games/robot-maze/index.js";
import { tugOfWar } from "./games/tug-of-war/index.js";

registerGame(robotMaze);
registerGame(robotMazeHard);
registerGame(tugOfWar);

// Load the fallback emoji font before the first render: emoji rendered before it arrived
// stayed as tofu boxes (seen in Chrome on Linux without a system emoji font).
await document.fonts.load('1em "Education Games Emoji"', "🤖");

startApp(
  /** @type {HTMLElement} */ (document.getElementById("header")),
  /** @type {HTMLElement} */ (document.getElementById("app")),
);
