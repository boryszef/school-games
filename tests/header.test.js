import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { emptyData } from "../src/core/storage.js";
import coreEn from "../src/i18n/en.js";
import { renderHeader } from "../src/screens/header.js";

/** @type {ReturnType<typeof installDom>} */
let dom;
beforeEach(() => {
  dom = installDom();
});

function render() {
  const header = dom.document.createElement("header");
  /** @type {import("../src/core/app.js").App} */
  const app = {
    data: { ...emptyData(), lang: "en" },
    t: (key, params) => translate(coreEn, key, params),
    update: () => {},
    navigate: () => {},
    refresh: () => {},
    returnHash: null,
  };
  renderHeader(header, app);
  return header;
}

test("the header links to the leaderboard on every screen", () => {
  const link = render().querySelector('a[href="#/leaderboard"]');
  assert.ok(link, "no leaderboard link");
  assert.equal(link.getAttribute("aria-label"), "Leaderboard");
  assert.ok(link.textContent?.includes("🏆"));
});

/** @param {HTMLElement} header */
function drawer(header) {
  const toggle = /** @type {HTMLButtonElement} */ (header.querySelector(".nav-toggle"));
  return {
    toggle,
    isOpen: () => header.classList.contains("is-open"),
    expanded: () => toggle.getAttribute("aria-expanded"),
  };
}

test("the leaderboard, player and language controls are in the drawer's nav", () => {
  const nav = render().querySelector("nav.site-nav");
  assert.ok(nav, "no nav");
  assert.ok(nav.querySelector('a[href="#/leaderboard"]'));
  assert.ok(nav.querySelector('a[href="#/players"]'));
  assert.ok(nav.querySelector("select.language"));
});

test("the menu button opens and closes the drawer", () => {
  const header = render();
  const { toggle, isOpen, expanded } = drawer(header);
  assert.equal(toggle.getAttribute("aria-label"), "Menu");
  assert.equal(toggle.getAttribute("aria-controls"), header.querySelector("nav")?.id);
  assert.ok(!isOpen());
  assert.equal(expanded(), "false");
  toggle.click();
  assert.ok(isOpen());
  assert.equal(expanded(), "true");
  toggle.click();
  assert.ok(!isOpen());
  assert.equal(expanded(), "false");
});

test("Esc closes the drawer", () => {
  const header = render();
  const { toggle, isOpen } = drawer(header);
  toggle.click();
  dom.document.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!isOpen());
});

test("a tap outside the drawer closes it", () => {
  const header = render();
  const { toggle, isOpen } = drawer(header);
  toggle.click();
  /** @type {HTMLElement} */ (header.querySelector(".nav-backdrop")).click();
  assert.ok(!isOpen());
});

test("following a link in the drawer closes it", () => {
  const header = render();
  const { toggle, isOpen } = drawer(header);
  toggle.click();
  /** @type {HTMLElement} */ (header.querySelector('nav a[href="#/players"]')).click();
  assert.ok(!isOpen());
});
