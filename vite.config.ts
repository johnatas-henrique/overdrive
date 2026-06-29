import { resolve } from "node:path";
import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [glsl()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  server: {
    port: 5174,
  },
});
