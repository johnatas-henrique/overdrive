/**
 * Persistence — Foundation layer storage abstraction.
 *
 * Pure TypeScript with zero external dependencies. Wraps localStorage
 * with an async-first interface, versioned payloads, and degraded mode.
 *
 * @see ADR-0016 — Persistence Interface
 */

export { MigrationError, PersistenceError } from "./errors";
export type {
  MigrationFn,
  PersistedEntry,
  PersistenceOptions,
} from "./persistence";
export { Persistence, PersistenceState } from "./persistence";
