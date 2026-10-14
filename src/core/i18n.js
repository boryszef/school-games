/** @typedef {Record<string, string>} Dictionary */
/** @typedef {Record<string, string | number>} TranslationParams */
/** @typedef {(key: string, params?: TranslationParams) => string} Translate */

/** Supported languages with their names shown in the switcher. */
export const LANGUAGE_NAMES = { pl: "Polski", en: "English" };

/**
 * @param {Dictionary} dictionary
 * @param {string} key
 * @param {TranslationParams} [params] Substituted for `{name}` placeholders.
 */
export function translate(dictionary, key, params = {}) {
  const text = dictionary[key];
  if (text === undefined) throw new Error(`Missing translation: ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name]));
}
