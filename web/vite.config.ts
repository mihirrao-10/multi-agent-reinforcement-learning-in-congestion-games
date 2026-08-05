import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/multi-agent-reinforcement-learning-in-congestion-games/",
  build: {
    target: "es2022",
    sourcemap: true,
    assetsInlineLimit: 4096,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
