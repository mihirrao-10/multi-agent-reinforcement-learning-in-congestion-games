import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/multi-agent-reinforcement-learning-in-congestion-games/",
  build: {
    target: "es2022",
    sourcemap: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 525,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/three/")) return "three";
          if (id.includes("/katex/")) return "katex";
          if (id.includes("/zod/")) return "validation";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
