/**
 * Game State Machine — Foundation layer state management.
 *
 * Flat FSM with `Record<State, State[]>` transition table.
 * Zero external dependencies. Zero Babylon.js APIs.
 *
 * @see ADR-0024 — Game State Machine
 */

export { GameStateError } from "./GameStateError";
export type { GameStateMachineOptions } from "./GameStateMachine";
export { GameStateMachine } from "./GameStateMachine";
export type { State } from "./State";
export type { StateDefinition } from "./StateDefinition";
export { TRANSITIONS } from "./TransitionTable";
