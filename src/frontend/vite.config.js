import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load env from root directory (../../)
    var rootEnv = loadEnv(mode, path.resolve(__dirname, "../.."), "");
    var frontendPort = parseInt(rootEnv.FRONTEND_PORT || "6173", 10);
    var backendPort = rootEnv.BACKEND_PORT || "6273";
    var backendHost = rootEnv.BACKEND_HOST || "localhost";
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
                    target: "http://".concat(backendHost, ":").concat(backendPort),
                    changeOrigin: true,
                },
            },
        },
    };
});
