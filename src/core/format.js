/**
 * @param {number} ms
 * @returns {string} e.g. "1:05.4"
 */
export function formatTime(ms) {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}
