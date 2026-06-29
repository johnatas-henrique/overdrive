/**
 * @fileoverview Mock AI telemetry data providers for Dev Tools playground.
 *
 * Returns sample per-car telemetry data (speed, position, behavior) for
 * three cars: one player car and two AI opponents. This mock is replaced
 * by real physics/AI driver system calls when those systems are implemented.
 *
 * ## Usage
 *
 * ```typescript
 * import { getMockAiTelemetry } from "./ai-telemetry-mock";
 * const data = getMockAiTelemetry(); // AiTelemetryCarData[]
 * ```
 *
 * @see TR-DVT-008 — AI Telemetry Tab
 * @see ADR-0009 — Dev Tools Architecture
 */

import type { AiTelemetryCarData } from "../core/dev-tools/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/**
 * Return mock AI telemetry data for three cars.
 *
 * Data is consistent on each call (static sample) — suitable for UI
 * development and testing. When real systems (Physics, RaceManager,
 * AI Driver) are implemented, this function is replaced by a reader
 * that aggregates data from those systems.
 *
 * @returns An array of three AiTelemetryCarData entries
 */
export function getMockAiTelemetry(): AiTelemetryCarData[] {
  return [
    {
      carId: "player-1",
      speed: 120,
      position: { lap: 3, trackProgress: 0.45, overall: 1 },
      behavior: "Normal",
    },
    {
      carId: "ai-1",
      speed: 115,
      position: { lap: 3, trackProgress: 0.42, overall: 2 },
      behavior: "Following",
    },
    {
      carId: "ai-2",
      speed: 108,
      position: { lap: 2, trackProgress: 0.88, overall: 3 },
      behavior: "Passing",
    },
  ];
}
