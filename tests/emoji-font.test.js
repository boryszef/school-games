import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);

/** @param {string} dir Relative to the repository root. */
const sourceFiles = (dir) =>
  readdirSync(new URL(dir, root), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(js|css|html)$/.test(file))
    .map((file) => `${dir}${file}`)
    .filter((path) => !path.startsWith("src/vendor/"));

test("every emoji the app shows is in the fallback emoji font", () => {
  const css = readFileSync(new URL("css/base.css", root), "utf8");
  const range = /unicode-range:([^;]+);/.exec(css);
  assert.ok(range, "no unicode-range in css/base.css");
  const inFont = new Set(range[1].split(",").map((u) => parseInt(u.trim().slice(2), 16)));

  const missing = new Set();
  for (const path of ["index.html", ...sourceFiles("src/"), ...sourceFiles("css/")]) {
    for (const [emoji] of readFileSync(new URL(path, root), "utf8").matchAll(
      // Shown as emoji: by default, or text symbols asked to be emoji with U+FE0F.
      /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu,
    )) {
      const code = /** @type {number} */ (emoji.codePointAt(0));
      if (!inFont.has(code)) missing.add(`${emoji} U+${code.toString(16).toUpperCase()} (${path})`);
    }
  }
  assert.deepEqual([...missing], []);
});

test("the emoji font's URL changes whenever the font does", () => {
  const css = readFileSync(new URL("css/base.css", root), "utf8");
  const version = /emoji-subset\.woff2\?v=(\w+)/.exec(css)?.[1];
  const font = readFileSync(new URL("fonts/emoji-subset.woff2", root));
  assert.equal(version, createHash("sha256").update(font).digest("hex").slice(0, 8));
});
