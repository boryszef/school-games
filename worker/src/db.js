/**
 * The part of the Cloudflare D1 API the Worker uses, so that tests can supply their own.
 * @typedef {string | number | null} Value
 * @typedef {object} Statement
 * @property {(...values: Value[]) => Statement} bind
 * @property {() => Promise<Record<string, unknown> | null>} first
 * @property {() => Promise<{results: Record<string, unknown>[]}>} all
 * @property {() => Promise<{meta: {changes: number}}>} run
 * @typedef {{prepare: (sql: string) => Statement}} Db
 */

export {};
