/**
 * @param {string} address e.g. `2001:db8::5c1e:a2ff:fe11:7b3c`
 * @returns {number[]} 16 bytes
 */
export function parseIpv6(address) {
  const [head, tail] = address.split("::");
  /** @param {string | undefined} part */
  const groups = (part) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const known = [...groups(head), ...groups(tail)];
  const zeros = tail === undefined ? [] : Array(8 - known.length).fill(0);
  const all = [...groups(head), ...zeros, ...groups(tail)];
  if (all.length !== 8 || all.some((g) => !(g >= 0 && g <= 0xffff))) {
    throw new Error(`Not an IPv6 address: ${address}`);
  }
  return all.flatMap((g) => [g >> 8, g & 0xff]);
}

/**
 * Formats 16 bytes the canonical way (RFC 5952): lowercase, no leading zeros, and the
 * longest run of two or more zero groups (the first one on a tie) shortened to `::`.
 * @param {number[]} bytes
 */
export function formatIpv6(bytes) {
  const groups = Array.from({ length: 8 }, (_, i) => (bytes[2 * i] << 8) | bytes[2 * i + 1]);
  let best = { start: -1, length: 1 };
  for (let start = 0; start < 8; start++) {
    let length = 0;
    while (start + length < 8 && groups[start + length] === 0) length++;
    if (length > best.length) best = { start, length };
  }
  const hex = groups.map((g) => g.toString(16));
  if (best.start === -1) return hex.join(":");
  const head = hex.slice(0, best.start).join(":");
  const tail = hex.slice(best.start + best.length).join(":");
  return `${head}::${tail}`;
}
