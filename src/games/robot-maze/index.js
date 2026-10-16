import { formatTime } from "../../core/format.js";
import { log } from "../../core/log.js";
import { ApiError, ServerUnreachableError, callApi } from "../../core/online/api.js";
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
/** @typedef {import("../../core/storage.js").Account} Account */
/** @typedef {Direction | {answer: number}} Action */
/**
 * A run the Worker times (R8.4): the maze comes from its seed, and the moves are recorded.
 * @typedef {{runId: string, seed: number, token: string}} ServerRun
 */

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

/** The same game on a 20×20 maze; it has its own stats and rankings (R4.11). */
export const robotMazeHard = _robotMaze({
  id: "robot-maze-hard",
  titleKey: "robotMaze.hardTitle",
  icon: "🦾",
  level: "hard",
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
  _serverRun(ctx.player.account, level).then((run) => {
    if (!cancelled) stopRound = _playRound(root, ctx, level, restart, run);
  });
  return () => {
    cancelled = true;
    stopRound();
  };
}

/**
 * @param {Account | null} account
 * @param {Level} level
 * @returns {Promise<ServerRun | null>} Null without an account or when the Worker can't be
 *   reached; the round is then played locally and can't be added to the leaderboard.
 */
async function _serverRun(account, level) {
  if (account === null) return null;
  try {
    const { data } = await callApi("POST", "/maze-runs", {
      token: account.token,
      body: { level },
      expect: [201],
    });
    log.debug("server-timed run", data.runId);
    return { runId: data.runId, seed: data.seed, token: account.token };
  } catch (error) {
    if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
    log.info("playing offline: this run can't be added to the leaderboard");
    return null;
  }
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
        run === null ? null : _submitRun(t, run, actions),
      ),
    );
  }

  return () => {
    clearInterval(ticker);
    window.removeEventListener("keydown", onKey);
  };
}

/**
 * @param {import("../../core/i18n.js").Translate} t
 * @param {ServerRun} run
 * @param {Action[]} actions
 */
function _submitRun(t, run, actions) {
  return submitToLeaderboard(t, async () => {
    const { data } = await callApi("POST", `/maze-runs/${run.runId}/finish`, {
      token: run.token,
      body: { actions },
      expect: [200],
    });
    log.info(`added to the leaderboard: ${data.timeMs} ms`);
    return t("robotMaze.leaderboardTime", { time: formatTime(data.timeMs) });
  });
}

/**
 * @param {Position} from
 * @param {Position} to
 * @returns {Direction | undefined}
 */
function _directionTowards(from, to) {
  return DIRECTIONS.find((dir) => positionKey(stepFrom(from, dir)) === positionKey(to));
}
