import { defineConfig } from "vitest/config";
import path from "path";

// Separate from vite.config.ts, whose `root` is the client directory — tests
// live alongside the server and shared code.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    root: import.meta.dirname,
    environment: "node",
    include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
  },
});
