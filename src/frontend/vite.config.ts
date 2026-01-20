import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env from root directory (../../)
  const rootEnv = loadEnv(mode, path.resolve(__dirname, "../.."), "");

  const frontendPort = parseInt(rootEnv.FRONTEND_PORT || "6173", 10);
  const backendPort = rootEnv.BACKEND_PORT || "6273";
  const backendHost = rootEnv.BACKEND_HOST || "localhost";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: frontendPort,
      host: true, // Listen on all network interfaces (0.0.0.0)
      proxy: {
        "/api": {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
