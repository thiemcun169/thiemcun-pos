import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Khi chạy local (npm run dev), proxy mọi gọi "/api" về FastAPI ở cổng 8000.
// Khi deploy Vercel, "/api" cùng origin nên không cần proxy (xem vercel.json).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
