import { formatTime } from "../../core/format.js";
import { log } from "../../core/log.js";
import { finishServerRun, startServerRun } from "../../core/online/server-run.js";
import { createRng } from "../../core/random.js";
import { createTimer } from "../../core/timer.js";
import { h, loadStylesheet } from "../../core/ui/dom.js";
import { createDpad } from "../../core/ui/dpad.js";
import { submitToLeaderboard } from "../../core/ui/leaderboard-submit.js";
import { createBoard } from "./board.js";
import { createChallengeDialog } from "./challenge.js";
import { messages } from "./i18n.js";
import { DIRECTIONS, stepFrom } from "./maze.js";
import { positionKey } from "./path.js";
import { createResultPanel } from "./result.js";
import { LEVELS, answer, createGame, move } from "./state.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("./maze.js").Direction} Direction */
/** @typedef {import("./maze.js").Position} Position */
/** @typedef {import("./state.js").GameState} GameState */
/** @typedef {import("./state.js").Level} Level */
/** @typedef {Direction | {answer: number}} Action */
/** @typedef {import("../../core/online/server-run.js").ServerRun} ServerRun */

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

export const robotMaze = _robotMaze({
  id: "robot-maze",
  titleKey: "robotMaze.title",
  icon: "🤖",
  level: "standard",
});

/**
 * @param {{id: string, titleKey: string, icon: string, level: Level}} options
 * @returns {import("../../core/registry.js").GameDefinition}
 */
function _robotMaze({ id, titleKey, icon, level }) {
  return {
    id,
    titleKey,
    icon,
    messages,
    mount(root, ctx) {
      loadStylesheet(new URL("./style.css", import.meta.url).href);
      let stopRound = () => {};
      const restart = () => {
        stopRound();
        stopRound = _startRound(root, ctx, level, restart);
      };
      restart();
      return () => stopRound();
    },
  };
}

/**
 * Gets a server-timed run for a registered player, then plays the maze; returns a cleanup
 * function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {Level} level
 * @param {() => void} restart
 */
function _startRound(root, ctx, level, restart) {
  let cancelled = false;
  let stopRound = () => {};
  root.replaceChildren(h("p", { class: "rm-preparing" }, ctx.t("robotMaze.preparing")));
  startServerRun(ctx.player.account, "/maze-runs", { level }).then((run) => {
    if (!cancelled) stopRound = _playRound(root, ctx, level, restart, run);
  });
  return () => {
    cancelled = true;
    stopRound();
  };
}

/**
 * Plays one maze; returns a cleanup function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {Level} level
 * @param {() => void} restart
 * @param {ServerRun | null} run
 */
function _playRound(root, ctx, level, restart, run) {
  const { t } = ctx;
  let state = createGame({
    ...LEVELS[level],
    rng: run === null ? Math.random : createRng(run.seed),
  });
  /** Only actions that changed the game; the ignored ones replay as nothing anyway. */
  /** @type {Action[]} */
  const actions = [];
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
  timer.start();
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
    const next = move(state, dir);
    if (next !== state) actions.push(dir);
    apply(next);
  }

  /** @param {number} value */
  function submitAnswer(value) {
    const penaltyBefore = state.penaltyMs;
    actions.push({ answer: value });
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
    log.info(`${level} robot maze finished in ${timeMs} ms with ${state.mistakes.length} mistakes`);
    stage.append(
      createResultPanel(
        t,
        { timeMs, mistakes: state.mistakes.length, previousBestMs },
        { onPlayAgain: restart, onHome: ctx.exit },
        run === null
          ? null
          : submitToLeaderboard(t, async () => {
              const { timeMs } = await finishServerRun(run, actions);
              return t("robotMaze.leaderboardTime", { time: formatTime(timeMs) });
            }),
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
