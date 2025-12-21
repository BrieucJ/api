import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../../packages/src"),
    },
  },
  define: {
    // Make environment variables available at build time
    "import.meta.env.VITE_BACKEND_URL": JSON.stringify(
      process.env.VITE_BACKEND_URL
    ),
  },
});
