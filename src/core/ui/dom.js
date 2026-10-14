/** @typedef {string | number | boolean | ((event: Event) => void)} AttributeValue */

/**
 * Creates an element. Attributes starting with "on" become event listeners,
 * `true` sets a boolean attribute and `false` omits it.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, AttributeValue>} [attributes]
 * @param {...(Node | string)} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value === "function") element.addEventListener(name.slice(2), value);
    else if (value === true) element.setAttribute(name, "");
    else if (value !== false) element.setAttribute(name, String(value));
  }
  element.append(...children);
  return element;
}

const loadedStylesheets = new Set();

/**
 * Adds a stylesheet to the page once, so games can bring their own CSS.
 * @param {string} href
 */
export function loadStylesheet(href) {
  if (loadedStylesheets.has(href)) return;
  loadedStylesheets.add(href);
  document.head.append(h("link", { rel: "stylesheet", href }));
}
