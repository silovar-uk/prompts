import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/prompts/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["catalog.json", "app-icon.svg"],
      manifest: {
        name: "Prompt Launcher",
        short_name: "Prompts",
        description: "文章やメモを貼るだけで、いま必要なプロンプトを3つに絞るランチャー",
        theme_color: "#f6f0e7",
        background_color: "#f6f0e7",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/prompts/",
        scope: "/prompts/",
        lang: "ja",
        icons: [
          { src: "app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
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
