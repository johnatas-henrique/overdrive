/**
 * Flat FSM transition table for the Game State Machine.
 *
 * Each state maps to an array of states it can transition to.
 * Any transition not in this table throws `GameStateError` at runtime.
 *
 * @see ADR-0024 — Game State Machine, Decision 1
 */

import type { State } from "./types";

export const TRANSITIONS: Record<State, State[]> = {
  Loading: ["Menu"],
  Menu: ["PreRace"],
  PreRace: ["Racing"],
  Racing: ["PostRace", "Paused"],
  Paused: ["Racing", "Menu"],
  PostRace: ["Menu", "PreRace"],
};
