import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { createQrCode } from "../src/core/ui/qr.js";

const QUIET_ZONE = 4;

beforeEach(() => {
  installDom();
});

/** @param {SVGSVGElement} svg */
const viewBoxSize = (svg) => Number(svg.getAttribute("viewBox")?.split(" ")[2]);

test("a short text gives a version 1 code (21 modules) with a quiet zone", () => {
  const svg = createQrCode("HELLO");
  assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(svg.getAttribute("viewBox"), `0 0 ${21 + 2 * QUIET_ZONE} ${21 + 2 * QUIET_ZONE}`);
  assert.ok(svg.querySelector("path")?.getAttribute("d"), "dark modules are drawn");
});

test("a long invitation link gives a bigger code", () => {
  const link = `https://boryszef.github.io/school-games/#/game/tug-of-war/join/${"x".repeat(250)}`;
  assert.ok(viewBoxSize(createQrCode(link)) > viewBoxSize(createQrCode("HELLO")));
});

test("the same text always gives the same code", () => {
  assert.equal(createQrCode("abc").outerHTML, createQrCode("abc").outerHTML);
});
