#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

git reset --hard HEAD
git pull --ff-only

cat > vite.config.ts <<'VITE'
// @lovable.dev/vite-tanstack-config already includes the following - do not add
// them manually or the app will break with duplicate plugins:
// - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare build target
// - componentTagger, VITE_* env injection, @ path alias, React/TanStack dedupe
// - error logger plugins and sandbox detection.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Self-host build for Ubuntu VPS. Lovable's default production target is
// Cloudflare Workers, so production deploy hard-pins Nitro to a Node HTTP server.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
    output: {
      dir: "dist",
      publicDir: "dist/client",
      serverDir: "dist/server",
    },
  },
});
VITE

bun install
rm -rf dist .output node_modules/.nitro
export NODE_OPTIONS=--max-old-space-size=1536
bun run build
sudo systemctl restart dl-life-canvas
