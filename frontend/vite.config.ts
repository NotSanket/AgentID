import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "ethers-vendor", test: /[\\/]node_modules[\\/]ethers[\\/]/ },
            { name: "motion-vendor", test: /[\\/]node_modules[\\/]framer-motion[\\/]/ },
            { name: "react-vendor", test: /[\\/]node_modules[\\/](?:react|react-dom|react-router|react-router-dom)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    restoreMocks: true,
  },
});
