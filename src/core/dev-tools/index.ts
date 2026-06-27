/**
 * @fileoverview Dev Tools entry point — tree-shaken in production builds.
 *
 * All Dev Tools code is guarded by `import.meta.env.DEV`, which Vite
 * evaluates at compile time: `true` in dev, `false` in production.
 * The minifier eliminates dead code when the guard is `false`, producing
 * zero bytes for the entire Dev Tools module tree in production bundles.
 *
 * This guard is testable at runtime via `vi.stubEnv("DEV", false)`,
 * unlike the compile-time `__DEV__` constant which cannot be stubbed.
 *
 * ## Dev Guard
 *
 * ```typescript
 * // Production code imports Dev Tools via dynamic import() behind the guard:
 * //
 * //   if (import.meta.env.DEV) {
 * //     const { DevTools } = await import('./core/dev-tools');
 * //   }
 * // ```
 *
 * Future stories (002-008) will add the overlay, metrics, data panels,
 * and input keybinds within this guard block.
 *
 * @see TR-DVT-006 — Tree-shaken in production via DEV guard
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D-G1 — Zero bytes in production build
 */

if (import.meta.env.DEV) {
  // Side-effect marker for compile guard verification (Story 001).
  // Tests assert this was called to prove the DEV guard block executes.
  // Will be replaced by real Dev Tools init in Stories 002-008.
  (globalThis as Record<string, unknown>).__DEV_TOOLS_LOADED__ = true;
}

export {};
