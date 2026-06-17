export const templateConfig = {
  features: {
    physics: true,
    axesViewer: import.meta.env.DEV,
    pipeline: true,
    gui: true,
  },
  rendering: {
    webgpuFirst: true,
    engine: {
      adaptToDeviceRatio: true,
      antialias: true,
      powerPreference: "high-performance" as const,
      stencil: true,
      disableWebGL2Support: false,
    },
  },
  debug: {
    showFps: true,
  },
} as const;
