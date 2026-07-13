import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/prompts/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["catalog.json", "favicon.svg", "icons/*.png"],
      manifest: {
        name: "Prompt Launcher",
        short_name: "Prompts",
        description: "スマホから、いま必要なプロンプトをすぐ呼び出すランチャー",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/prompts/",
        scope: "/prompts/",
        lang: "ja",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html"
      },
      devOptions: { enabled: false }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: true
  }
});
