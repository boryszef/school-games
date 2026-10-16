import { ANIMALS, COLORS, formatNickname } from "../../src/core/online/nickname.js";
import { hashToken, randomId, randomToken } from "./ids.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */

const BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/;

/**
 * Players are known by a public id and a nickname; a secret token proves who is calling.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createPlayers({ db, now, randomBytes }) {
  return {
    /**
     * A random color and animal, and the next free number for that pair. Picking the number
     * inside the INSERT keeps it unique when two players are created at the same time.
     * @returns {Promise<Reply>}
     */
    async create() {
      const [colorByte, animalByte] = randomBytes(2);
      const color = colorByte % COLORS.length;
      const animal = animalByte % ANIMALS.length;
      const id = randomId(randomBytes);
      const token = randomToken(randomBytes);
      await db
        .prepare(
          `INSERT INTO players (id, token_hash, color, animal, number, created_at)
           SELECT ?, ?, ?, ?, COALESCE(MAX(number), 0) + 1, ?
           FROM players WHERE color = ? AND animal = ?`,
        )
        .bind(id, await hashToken(token), color, animal, now(), color, animal)
        .run();
      const row = /** @type {{number: number}} */ (
        await db.prepare("SELECT number FROM players WHERE id = ?").bind(id).first()
      );
      return {
        status: 201,
        body: { id, token, nickname: formatNickname({ color, animal, number: row.number }) },
      };
    },

    /**
     * @param {Request} request
     * @returns {Promise<string | null>} The calling player's id, or null without a valid token.
     */
    async authenticate(request) {
      const match = BEARER.exec(request.headers.get("Authorization") ?? "");
      if (match === null) return null;
      const row = await db
        .prepare("SELECT id FROM players WHERE token_hash = ?")
        .bind(await hashToken(match[1]))
        .first();
      return row === null ? null : String(row.id);
    },

    /** @param {string} id */
    async exists(id) {
      return (await db.prepare("SELECT 1 FROM players WHERE id = ?").bind(id).first()) !== null;
    },
  };
}
