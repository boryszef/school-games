/** @typedef {"en" | "de" | "es"} TargetLanguage */
/** @typedef {{id: string, css: string}} Color */

/** @type {Color[]} */
export const COLORS = [
  { id: "red", css: "#e53935" },
  { id: "orange", css: "#fb8c00" },
  { id: "yellow", css: "#fdd835" },
  { id: "green", css: "#43a047" },
  { id: "blue", css: "#1e88e5" },
  { id: "purple", css: "#8e24aa" },
  { id: "pink", css: "#f48fb1" },
  { id: "brown", css: "#795548" },
  { id: "black", css: "#000000" },
  { id: "white", css: "#ffffff" },
];

/** Each language's name in that language, as the picker shows it. */
/** @type {Record<TargetLanguage, string>} */
export const TARGET_LANGUAGES = { en: "English", de: "Deutsch", es: "Español" };

/** @type {Record<TargetLanguage, Record<string, string>>} */
export const COLOR_NAMES = {
  en: {
    red: "red",
    orange: "orange",
    yellow: "yellow",
    green: "green",
    blue: "blue",
    purple: "purple",
    pink: "pink",
    brown: "brown",
    black: "black",
    white: "white",
  },
  de: {
    red: "rot",
    orange: "orange",
    yellow: "gelb",
    green: "grün",
    blue: "blau",
    purple: "lila",
    pink: "rosa",
    brown: "braun",
    black: "schwarz",
    white: "weiß",
  },
  es: {
    red: "rojo",
    orange: "naranja",
    yellow: "amarillo",
    green: "verde",
    blue: "azul",
    purple: "morado",
    pink: "rosa",
    brown: "marrón",
    black: "negro",
    white: "blanco",
  },
};
