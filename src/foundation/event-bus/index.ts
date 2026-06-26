/**
 * Event Bus — Foundation layer typed event system.
 *
 * Pure TypeScript types, interfaces, error class, and runtime implementation
 * with zero external dependencies.
 *
 * @see ADR-0001 — Event Bus Architecture
 */

export { EventBusError } from "./errors";
export { EventBus } from "./event-bus";
export type {
  EventBusConfig,
  EventMap,
  IEventBus,
  PitState,
  RaceResults,
  Subscription,
} from "./types";
