const debugEnabled =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");

/** Thin console wrapper; debug output is enabled with `?debug=1`. */
export const log = {
  /** @param {...unknown} args */
  debug: (...args) => {
    if (debugEnabled) console.debug(...args);
  },
  /** @param {...unknown} args */
  info: (...args) => console.info(...args),
};
