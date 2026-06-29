/// <reference types="vite/client" />

/**
 * Dev Tools and Telemetry Recorder are guarded by `import.meta.env.DEV`,
 * which Vite evaluates at compile time: `true` in dev, `false` in
 * production. The minifier eliminates dead code branches guarded by
 * this check, ensuring Dev Infra code produces zero bytes in production.
 *
 * @see TR-DVT-006 — Tree-shaken in production via DEV guard
 * @see Control Manifest D-G1 — Zero bytes in production build
 */

interface GlobalThis {
  /** Side-effect marker set by Dev Tools entry point when DEV=true (Story 001) */
  __DEV_TOOLS_LOADED__?: boolean;
}
