/**
 * Stopwatch; `now` is injectable for tests.
 * @param {() => number} [now]
 */
export function createTimer(now = () => performance.now()) {
  /** @type {number | null} */
  let startedAt = null;
  /** @type {number | null} */
  let stoppedAt = null;

  return {
    start() {
      if (startedAt === null) startedAt = now();
    },
    stop() {
      stoppedAt = now();
    },
    elapsedMs() {
      if (startedAt === null) return 0;
      return (stoppedAt ?? now()) - startedAt;
    },
  };
}
