import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Play allocates both ports at spawn time; the fallbacks only serve local runs outside it.
const LOOPBACK_HOST = "127.0.0.1";
const port = Number(process.env.PORT) || 5173;
const backendPort = Number(process.env.BACKEND_PORT) || 3301;

// Keep the original Host header so the backend host guard still sees the loopback origin.
const apiProxy = {
  "/api": { target: `http://${LOOPBACK_HOST}:${backendPort}`, changeOrigin: false },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { host: LOOPBACK_HOST, port, strictPort: true, proxy: apiProxy },
  preview: { host: LOOPBACK_HOST, port, strictPort: true, proxy: apiProxy },
});
