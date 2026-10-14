import { formatTime } from "../../core/format.js";
import { log } from "../../core/log.js";
import { createTimer } from "../../core/timer.js";
import { h, loadStylesheet } from "../../core/ui/dom.js";
import { createDpad } from "../../core/ui/dpad.js";
import { createBoard } from "./board.js";
import { createChallengeDialog } from "./challenge.js";
import { messages } from "./i18n.js";
import { DIRECTIONS, stepFrom } from "./maze.js";
import { positionKey } from "./path.js";
import { createResultPanel } from "./result.js";
import { answer, createGame, move } from "./state.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("./maze.js").Direction} Direction */
/** @typedef {import("./maze.js").Position} Position */
/** @typedef {import("./state.js").GameState} GameState */

const SIZE = 10;
const ROBOT_COUNT = 10;
const CLOCK_REFRESH_MS = 100;

/** @type {Record<string, Direction>} */
const KEY_DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

/** @type {import("../../core/registry.js").GameDefinition} */
export const robotMaze = {
  id: "robot-maze",
  titleKey: "robotMaze.title",
  icon: "🤖",
  messages,
  mount(root, ctx) {
    loadStylesheet(new URL("./style.css", import.meta.url).href);
    let stopRound = () => {};
    const restart = () => {
      stopRound();
      stopRound = _startRound(root, ctx, restart);
    };
    restart();
    return () => stopRound();
  },
};

/**
 * Plays one maze; returns a cleanup function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {() => void} restart
 */
function _startRound(root, ctx, restart) {
  const { t } = ctx;
  let state = createGame({ size: SIZE, robotCount: ROBOT_COUNT, rng: Math.random });
  const timer = createTimer();
  const clock = h("span", { class: "rm-clock" }, formatTime(0));
  const board = createBoard(state.maze, (pos) => tryMove(_directionTowards(state.player, pos)));
  const dialog = createChallengeDialog(t, submitAnswer);
  const stage = h("div", { class: "rm-stage" }, board.element, dialog.element);

  root.replaceChildren(
    h(
      "div",
      { class: "rm" },
      h("p", { class: "rm-goal" }, t("robotMaze.goal")),
      h("p", { class: "rm-hud" }, `⏱ ${t("robotMaze.time")}: `, clock),
      stage,
      createDpad(tryMove, t),
    ),
  );
  board.update(state);
  const ticker = setInterval(() => (clock.textContent = formatTime(totalMs())), CLOCK_REFRESH_MS);
  window.addEventListener("keydown", onKey);

  function totalMs() {
    return timer.elapsedMs() + state.penaltyMs;
  }

  /** @param {KeyboardEvent} event */
  function onKey(event) {
    const dir = KEY_DIRECTIONS[event.key];
    if (dir === undefined || state.challenge !== null) return;
    event.preventDefault();
    tryMove(dir);
  }

  /** @param {Direction | undefined} dir undefined when a tapped cell is not adjacent. */
  function tryMove(dir) {
    if (dir === undefined) return;
    timer.start();
    apply(move(state, dir));
  }

  /** @param {number} value */
  function submitAnswer(value) {
    const penaltyBefore = state.penaltyMs;
    apply(answer(state, value));
    if (state.penaltyMs > penaltyBefore) dialog.showWrong();
  }

  /** @param {GameState} next */
  function apply(next) {
    const opened = next.challenge !== null && state.challenge === null;
    state = next;
    board.update(state);
    if (state.challenge === null) dialog.hide();
    else if (opened) dialog.show(state.challenge);
    if (state.finished) finish();
  }

  function finish() {
    timer.stop();
    clearInterval(ticker);
    const timeMs = totalMs();
    clock.textContent = formatTime(timeMs);
    const previousBestMs = ctx.bestTimeMs();
    ctx.recordRun({ timeMs, penaltyMs: state.penaltyMs, mistakes: state.mistakes });
    log.info(`robot-maze finished in ${timeMs} ms with ${state.mistakes.length} mistakes`);
    stage.append(
      createResultPanel(
        t,
        { timeMs, mistakes: state.mistakes.length, previousBestMs },
        { onPlayAgain: restart, onHome: ctx.exit },
      ),
    );
  }

  return () => {
    clearInterval(ticker);
    window.removeEventListener("keydown", onKey);
  };
}

/**
 * @param {Position} from
 * @param {Position} to
 * @returns {Direction | undefined}
 */
function _directionTowards(from, to) {
  return DIRECTIONS.find((dir) => positionKey(stepFrom(from, dir)) === positionKey(to));
}
