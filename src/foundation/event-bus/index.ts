/**
 * Event Bus — Foundation layer typed event system.
 *
 * Pure TypeScript types, interfaces, and error class with zero external
 * dependencies. The runtime Event Bus is implemented in Story 002.
 *
 * @see ADR-0001 — Event Bus Architecture
 */

export { EventBusError } from "./errors";
export type {
  EventMap,
  IEventBus,
  PitState,
  RaceResults,
  Subscription,
} from "./types";
