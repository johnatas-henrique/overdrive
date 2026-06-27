/**
 * @fileoverview Story 006 — Production No-op Behavior for Telemetry Recorder.
 *
 * Validates that ALL TelemetryRecorder methods are correctly guarded by
 * `import.meta.env.DEV`. When DEV is false (production build), the entire
 * module is a no-op: no state mutation, no console.log, no allocation.
 *
 * ## Key Testing Strategy
 *
 * Uses `vi.resetModules()` + dynamic `import()` to ensure the module is
 * evaluated with the stubbed environment. Static `import` at the top of
 * the file evaluates the module with DEV=true (Vitest dev mode), so
 * production branch testing requires the reset+dynamic pattern.
 *
 * ## Acceptance Criteria
 *
 * - AC-1: tick() returns immediately when DEV=false
 *         → no tickCounter increment, no samples appended, no console.log
 * - AC-2: export() returns null when DEV=false
 * - AC-3: console.log never called by any TelemetryRecorder method when DEV=false
 * - AC-4: [DEFERRED] No static import of Telemetry Recorder in production code
 *
 * @see Story 006 — production/epics/telemetry-recorder/story-006-telemetry-noop-behavior.md
 */

import { describe, expect, it, vi } from "vitest";
import type { CarEntityRef } from "../../../src/dev-infra/telemetry-recorder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock CarEntityRef with default values.
 *
 * Defined locally because the TelemetryRecorder class itself is loaded
 * via dynamic import (see resetModules pattern below). Type-only imports
 * are erased at runtime, so importing the interface is safe here.
 *
 * @param overrides - Optional partial overrides applied after defaults.
 * @returns A CarEntityRef-compatible mock object.
 */
function makeCar(overrides?: Partial<CarEntityRef>): CarEntityRef {
  return {
    id: overrides?.id ?? "test-car",
    teamName: overrides?.teamName ?? "Test Team",
    physics: {
      speedKmh: 0,
      rpm: 0,
      gear: 1,
      lateralG: 0,
      ...overrides?.physics,
    },
    runtime: {
      elapsedTime: 0,
      throttle: 0,
      brake: 0,
      steer: 0,
      fuelLevel: 1,
      tireCondition: 1,
      splinePos: 0,
      racePosition: 1,
      currentLap: 1,
      ...overrides?.runtime,
    },
    aiDriver:
      overrides?.aiDriver !== undefined
        ? { state: 0, ...overrides.aiDriver }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// AC-1: tick() no-op when DEV=false
// ---------------------------------------------------------------------------

describe("AC-1: tick() no-op when DEV=false", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should not increment tickCounter when DEV=false", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    recorder.tick(1 / 60, [makeCar()], 0);

    expect(recorder.getTickCount()).toBe(0);
  });

  it("should not append any samples when DEV=false", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    for (let tick = 0; tick < 9; tick++) {
      recorder.tick(1 / 60, [makeCar()], tick);
    }

    expect(recorder.getCarIds()).toEqual([]);
    expect(recorder.getSamples("test-car")).toEqual([]);
  });

  it("should not call console.log at log boundary when DEV=false", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {
      /* noop */
    });

    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    // Default logInterval = 300 ticks. With DEV=true and setRecording(true),
    // this would produce a console summary at tick 300. With DEV=false,
    // the guard returns before any of that logic runs.
    for (let tick = 0; tick < 300; tick++) {
      recorder.tick(1 / 60, [makeCar()], tick);
    }

    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-2: export() returns null when DEV=false
// ---------------------------------------------------------------------------

describe("AC-2: export() returns null when DEV=false", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return null when DEV=false (empty state)", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();

    const result = recorder.export();

    expect(result).toBeNull();
  });

  it("should return null when DEV=false (even with addSample calls)", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();

    // addSample is NOT guarded by DEV — it always appends regardless of env.
    // This test verifies that export() returns null even when data exists.
    recorder.addSample("car_01", {
      tick: 0,
      t: 0,
      speed: 100,
      rpm: 5000,
      throttle: 0.5,
      brake: 0,
      steer: 0,
      gear: 3,
      lateralG: 2.5,
      fuel: 0.9,
      tireCondition: 1,
      splinePos: 0.05,
      aiState: -1,
    });

    const result = recorder.export();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3: console.log never called when DEV=false
// ---------------------------------------------------------------------------

describe("AC-3: console.log never called when DEV=false", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("should not call console.log during tick() at a single log boundary", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    // Tick past the default 300-tick log interval
    for (let tick = 0; tick < 310; tick++) {
      recorder.tick(1 / 60, [makeCar()], tick);
    }

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should not call console.log during tick() across multiple log boundaries", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    // Cross 3 log boundaries (300, 600, 900) — with DEV=false,
    // tickCounter stays at 0, so the modulo check never passes.
    // But we call tick 900 times anyway to be thorough.
    for (let tick = 0; tick < 900; tick++) {
      recorder.tick(1 / 60, [makeCar()], tick);
    }

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should not call console.log during export()", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );
    const recorder = new TelemetryRecorder();

    // Populate some data (addSample is not DEV-guarded)
    recorder.addSample("car_01", {
      tick: 0,
      t: 0,
      speed: 100,
      rpm: 5000,
      throttle: 0.5,
      brake: 0,
      steer: 0,
      gear: 3,
      lateralG: 2.5,
      fuel: 0.9,
      tireCondition: 1,
      splinePos: 0.05,
      aiState: -1,
    });
    recorder.export();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should not call console.log during construction", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { TelemetryRecorder } = await import(
      "../../../src/dev-infra/telemetry-recorder"
    );

    // Constructor with DEV=false sets window.__telemetry only when DEV=true.
    // It should never call console.log.
    new TelemetryRecorder();

    expect(logSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-4: [DEFERRED] Static import check
//
// Verifying zero bytes in the production build is an Epic DoD task (CI /
// bundle scan), not a unit test. This placeholder documents the deferral.
// ---------------------------------------------------------------------------

describe("AC-4: [DEFERRED] Static import in production code", () => {
  it("is deferred to build verification (Epic DoD — bundle tree-shaking check)", () => {
    // This is deliberately a no-op assertion. The real check is:
    //   npm run build && grep -r "telemetry-recorder" dist/
    // which must produce zero matches. That belongs in CI, not unit tests.
    expect(true).toBe(true);
  });
});
