import path from "node:path";

import { Config } from "@remotion/cli/config";

// scripts/record.mjs --remotion writes .recordings/remotion/<name>/; only that
// folder is bundled, not the plain MP4s and renders next to it.
Config.setPublicDir("../../.recordings/remotion");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);

// geist only exports its next/font wrappers, so its files are reached by path;
// Cal Sans and Commit Mono are the dashboard's own copies.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@fonts/geist": path.resolve("node_modules/geist/dist/fonts"),
      "@fonts/dashboard": path.resolve("../../apps/dashboard/public/fonts"),
    },
  },
}));
