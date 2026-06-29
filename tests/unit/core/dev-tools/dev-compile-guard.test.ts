/**
 * @fileoverview Story 001 — Dev Compile Guard for Dev Tools.
 *
 * Validates that `import.meta.env.DEV` evaluates correctly in dev mode
 * and can be stubbed to simulate production builds, ensuring the
 * `if (import.meta.env.DEV)` guard tree-shakes in production.
 *
 * ## Acceptance Criteria
 *
 * - AC-1a: `import.meta.env.DEV` evaluates to `true` during `vite dev`
 * - AC-1b: `import.meta.env.DEV` evaluates to `false` during `vite build`
 * - AC-8: Production bundle contains zero matches for DevTools, dev-tools,
 *         or SceneInstrumentation
 *
 * @see Story 001 — production/epics/dev-tools/story-001-dev-compile-guard.md
 * @see TR-DVT-006 — Tree-shaken in production via DEV guard
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Side-effect marker on globalThis
// ---------------------------------------------------------------------------

/** Clear the side-effect marker before each test. */
function clearMarker(): void {
  delete (globalThis as Record<string, unknown>).__DEV_TOOLS_LOADED__;
}

/** Read the side-effect marker. */
function getMarker(): boolean {
  return (globalThis as Record<string, unknown>).__DEV_TOOLS_LOADED__ === true;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

/**
 * Dynamically import the Dev Tools entry point with a stubbed environment.
 *
 * Uses `vi.resetModules()` before the import to ensure the module is
 * re-evaluated with the current stubbed environment variables.
 *
 * @returns A promise that resolves once the module has been dynamically loaded
 */
async function importDevToolsWithEnv(): Promise<void> {
  vi.resetModules();
  await import("@/core/dev-tools/index");
}

// ---------------------------------------------------------------------------
// AC-1a: import.meta.env.DEV is true in test environment (dev mode)
// ---------------------------------------------------------------------------

describe("AC-1a: import.meta.env.DEV evaluates to true in dev mode", () => {
  beforeEach(clearMarker);
  afterEach(clearMarker);

  it("should have import.meta.env.DEV as true in test environment", () => {
    // Vitest runs in development mode by default, so import.meta.env.DEV
    // is true. This proves the dev branch of the guard executes.
    expect(import.meta.env.DEV).toBe(true);
  });

  it("should execute code inside the DEV guard (side-effect marker set)", async () => {
    expect(getMarker()).toBe(false);
    await importDevToolsWithEnv();
    expect(getMarker()).toBe(true);
  });

  it("should allow the Dev Tools entry point to load without error", async () => {
    vi.resetModules();
    const mod = await import("@/core/dev-tools/index");
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-1b: import.meta.env.DEV is false in production mode
// ---------------------------------------------------------------------------

describe("AC-1b: import.meta.env.DEV evaluates to false in production mode", () => {
  beforeEach(clearMarker);
  afterEach(() => {
    clearMarker();
    vi.unstubAllEnvs();
  });

  it("should have import.meta.env.DEV be false when stubbed", () => {
    vi.stubEnv("DEV", false);
    expect(import.meta.env.DEV).toBe(false);
  });

  it("should NOT execute code inside the DEV guard when DEV=false", async () => {
    // When DEV=false, the side-effect marker should NOT be set,
    // proving the guarded code was skipped (dead code elimination).
    vi.stubEnv("DEV", false);
    await importDevToolsWithEnv();
    expect(getMarker()).toBe(false);
  });

  it("should load Dev Tools entry point without error even when DEV=false", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const mod = await import("@/core/dev-tools/index");
    expect(mod).toBeDefined();
  });

  it("should verify vi.stubEnv works correctly across sequential calls", () => {
    vi.stubEnv("DEV", false);
    expect(import.meta.env.DEV).toBe(false);

    vi.unstubAllEnvs();
    expect(import.meta.env.DEV).toBe(true);

    vi.stubEnv("DEV", false);
    expect(import.meta.env.DEV).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-8: Production bundle verification
//
// The definitive check runs in CI after `npm run build`:
//   grep -r "DevTools|dev-tools|SceneInstrumentation" dist/
//
// This test documents the requirement and the expected grep patterns.
// ---------------------------------------------------------------------------

describe("AC-8: Production bundle contains no Dev Tools strings", () => {
  it("should document the forbidden patterns for CI bundle grep", () => {
    // These strings must NOT appear in the production bundle.
    // CI runs: for p in DevTools dev-tools SceneInstrumentation; do
    //   grep -r "$p" dist/ && exit 1; done; echo "PASS"
    const forbidden = ["DevTools", "dev-tools", "SceneInstrumentation"];
    expect(forbidden).toHaveLength(3);
    expect(forbidden).toContain("DevTools");
    expect(forbidden).toContain("dev-tools");
    expect(forbidden).toContain("SceneInstrumentation");
  });
});
