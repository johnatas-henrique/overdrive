#!/usr/bin/env node
/**
 * GUI MCP Server wrapper — starts CORS proxy + MCP server together.
 *
 * The stock @babylonjs/mcp-servers GUI MCP server does not configure CORS
 * for gui.babylonjs.com, so the browser blocks the preview connection.
 * This wrapper runs the CORS proxy (port 3002 → 3001) alongside the MCP
 * server so gui.babylonjs.com works out of the box.
 *
 * Used by opencode.json MCP config:
 *   "command": ["node", "tools/gui-mcp-wrapper.mjs"]
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const proxyScript = join(__dirname, "cors-proxy.mjs");

let proxyKilled = false;
let mcpKilled = false;

function cleanup() {
  if (!proxyKilled) {
    proxy.kill();
    proxyKilled = true;
  }
}

// Start CORS proxy (port 3002 → 3001)
const proxy = spawn("node", [proxyScript], {
  stdio: ["ignore", "pipe", "pipe"],
});

proxy.stdout.on("data", (d) => process.stderr.write(d));
proxy.stderr.on("data", (d) => process.stderr.write(d));
proxy.on("error", (err) => {
  process.stderr.write(`[gui-wrapper] proxy failed: ${err.message}\n`);
});
proxy.on("exit", (code) => {
  proxyKilled = true;
  if (code && code !== 0 && code !== null) {
    process.stderr.write(
      `[gui-wrapper] proxy exited ${code} — CORS preview may not work\n`
    );
  }
});

// Start MCP server (stdio passthrough to OpenCode)
const mcp = spawn("npx", ["-y", "@babylonjs/mcp-servers@latest", "gui"], {
  stdio: "inherit",
});

mcp.on("error", (err) => {
  process.stderr.write(`[gui-wrapper] MCP server failed: ${err.message}\n`);
  cleanup();
  process.exit(1);
});

mcp.on("exit", (code) => {
  mcpKilled = true;
  cleanup();
  process.exit(code ?? 0);
});

// Cleanup on signals
function handleSignal(sig) {
  cleanup();
  if (!mcpKilled) mcp.kill(sig);
  process.exit(0);
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));
