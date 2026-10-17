import { h } from "../../core/ui/dom.js";
import { TARGET_LANGUAGES } from "./colors.js";

/** @typedef {import("./colors.js").TargetLanguage} TargetLanguage */

/**
 * Buttons for the language to practise; the last one chosen is highlighted and focused.
 * @param {import("../../core/i18n.js").Translate} t
 * @param {TargetLanguage | null} lastChosen
 * @param {(lang: TargetLanguage) => void} onChoose
 */
export function createLanguagePicker(t, lastChosen, onChoose) {
  const languages = /** @type {[TargetLanguage, string][]} */ (Object.entries(TARGET_LANGUAGES));
  return h(
    "div",
    { class: "ci-picker" },
    h("h2", {}, t("colorInvasion.chooseLanguage")),
    ...languages.map(([lang, name]) =>
      h(
        "button",
        {
          type: "button",
          class: lang === lastChosen ? "button ci-language is-last" : "button ci-language",
          autofocus: lang === lastChosen,
          onclick: () => onChoose(lang),
        },
        name,
      ),
    ),
  );
}
