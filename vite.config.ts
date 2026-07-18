import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/prompts/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["catalog.json", "reference-catalog.json", "prompts.md", "llms.txt", "sitemap.xml", "robots.txt", "app-icon.svg"],
      manifest: {
        name: "Prompts｜人が読めて、AIが実行できるプロンプト集",
        short_name: "Prompts",
        description: "人が読んで選び、AIにURLで渡せる公開プロンプト・ライブラリ",
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
        globPatterns: ["**/*.{js,css,html,svg,png,json,md,txt,xml}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/prompts\/p\//]
      },
      devOptions: { enabled: false }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: true
  }
});
