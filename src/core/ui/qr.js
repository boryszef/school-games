import { qrcodegen } from "../../vendor/qrcodegen.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Light margin around the code, in modules; scanners need at least 4. */
const QUIET_ZONE = 4;

/**
 * Renders `text` as a QR code SVG that scales to its container.
 * @param {string} text
 * @returns {SVGSVGElement}
 */
export function createQrCode(text) {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.LOW);
  const side = qr.size + 2 * QUIET_ZONE;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${side} ${side}`);
  svg.setAttribute("class", "qr-code");
  svg.setAttribute("role", "img");
  svg.setAttribute("shape-rendering", "crispEdges");
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", "#fff");
  const modules = document.createElementNS(SVG_NS, "path");
  modules.setAttribute("d", _darkModulesPath(qr));
  modules.setAttribute("fill", "#000");
  svg.append(background, modules);
  return svg;
}

/** @param {qrcodegen.QrCode} qr */
function _darkModulesPath(qr) {
  const squares = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) squares.push(`M${x + QUIET_ZONE},${y + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return squares.join("");
}
