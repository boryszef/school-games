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
