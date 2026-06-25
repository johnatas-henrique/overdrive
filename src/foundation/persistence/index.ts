/**
 * Persistence — Foundation layer storage abstraction.
 *
 * Pure TypeScript with zero external dependencies. Wraps localStorage
 * with an async-first interface, versioned payloads, and degraded mode.
 *
 * @see ADR-0016 — Persistence Interface
 */

export { PersistenceError } from "./errors";
export type { MigrationFn } from "./persistence";
export { Persistence, PersistenceState } from "./persistence";
