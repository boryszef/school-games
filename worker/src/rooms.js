import { ROOM_CODE_LENGTH, roomCodeFrom } from "../../src/core/net/room-code.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {{status: number, body?: object}} Reply */

const ROOM_TTL_MS = 10 * 60 * 1000;

/**
 * Passes a host's offer to one guest and the guest's answer back. A room lives until the host
 * has the answer, or 10 minutes at most, since both texts contain the players' IP addresses.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createRooms({ db, now, randomBytes }) {
  const oldest = () => now() - ROOM_TTL_MS;

  /** @param {string} code */
  const find = (code) =>
    db
      .prepare("SELECT offer, answer FROM rooms WHERE code = ? AND created_at > ?")
      .bind(code, oldest())
      .first();

  return {
    /**
     * @param {string} offer
     * @returns {Promise<Reply>}
     */
    async create(offer) {
      await db.prepare("DELETE FROM rooms WHERE created_at <= ?").bind(oldest()).run();
      const code = roomCodeFrom(randomBytes(ROOM_CODE_LENGTH));
      await db
        .prepare("INSERT INTO rooms (code, offer, created_at) VALUES (?, ?, ?)")
        .bind(code, offer, now())
        .run();
      return { status: 201, body: { code } };
    },

    /**
     * @param {string} code
     * @returns {Promise<Reply>}
     */
    async offer(code) {
      const room = await find(code);
      if (room === null) return { status: 404 };
      if (room.answer !== null) return { status: 409 };
      return { status: 200, body: { offer: room.offer } };
    },

    /**
     * @param {string} code
     * @param {string} answer
     * @returns {Promise<Reply>}
     */
    async answer(code, answer) {
      if ((await find(code)) === null) return { status: 404 };
      const { meta } = await db
        .prepare("UPDATE rooms SET answer = ? WHERE code = ? AND answer IS NULL")
        .bind(answer, code)
        .run();
      return { status: meta.changes === 1 ? 204 : 409 };
    },

    /**
     * The host collects the answer; the room is deleted with it.
     * @param {string} code
     * @returns {Promise<Reply>}
     */
    async takeAnswer(code) {
      const room = await find(code);
      if (room === null) return { status: 404 };
      if (room.answer === null) return { status: 204 };
      await db.prepare("DELETE FROM rooms WHERE code = ?").bind(code).run();
      return { status: 200, body: { answer: room.answer } };
    },
  };
}
