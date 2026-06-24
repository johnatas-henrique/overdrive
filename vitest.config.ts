import { resolve } from "node:path";
import glsl from "vite-plugin-glsl";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [glsl()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
