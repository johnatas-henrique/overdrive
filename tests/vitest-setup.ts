import { afterEach, beforeEach, vi } from "vitest";

// Suppress all console output during tests.
// Individual tests that NEED to verify console output should
// re-spy and assert within their own scope.
beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});

  // Suppress Babylon.js Logger output.
  // Logger._Levels stores direct references to console.log/warn/error at
  // module load time, so our console mock above doesn't intercept BJS calls.
  // Mocking Logger.Log and Logger.Warn at the source prevents the output.
  try {
    // Dynamic ESM import to avoid CommonJS require() in ESM context (CR26)
    const { Logger } = await import("@babylonjs/core/Misc/logger");
    if (Logger?.Log) vi.spyOn(Logger, "Log").mockImplementation(() => {});
    if (Logger?.Warn) vi.spyOn(Logger, "Warn").mockImplementation(() => {});
    if (Logger?.Error) vi.spyOn(Logger, "Error").mockImplementation(() => {});
  } catch {
    // Babylon.js not loaded yet — safe to ignore
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});
