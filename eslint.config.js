import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "src/vendor/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["worker/**/*.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
];
