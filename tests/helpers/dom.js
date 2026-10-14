import { JSDOM } from "jsdom";

/**
 * Installs a fresh jsdom document as the global DOM for browser code under test.
 * `matchMedia` reports a fine pointer (desktop), which jsdom does not implement.
 */
export function installDom() {
  const { window } = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  Object.assign(globalThis, {
    window,
    document: window.document,
    matchMedia: () => ({ matches: true }),
  });
  return window;
}
