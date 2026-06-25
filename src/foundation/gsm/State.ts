/**
 * Game State Machine states.
 *
 * Represents the distinct phases of a racing game session.
 * Each state drives different behavior across all systems —
 * Camera, HUD, Audio, Input, Physics, etc.
 *
 * @see ADR-0024 — Game State Machine, Decision 1
 */

export type State =
  | "Loading"
  | "Menu"
  | "PreRace"
  | "Racing"
  | "Paused"
  | "PostRace";
