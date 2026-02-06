#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");
const DIST_PUBLIC_DIR = join(ROOT_DIR, "dist/public");
const PUBLIC_DIR = join(ROOT_DIR, "public");
const WEB_APP_PUBLIC_DIR = join(ROOT_DIR, "../../apps/web/public");

console.log("📦 Copying registry to web app...");

// Check if the registry was built in dist/public/r or public/r
let registryDir = join(DIST_PUBLIC_DIR, "r");
if (!existsSync(registryDir)) {
  registryDir = join(PUBLIC_DIR, "r");
  if (!existsSync(registryDir)) {
    console.error("❌ Registry not found at dist/public/r/ or public/r/");
    console.error("   Run 'pnpm registry:build' first");
    process.exit(1);
  }
}

// Ensure web app public directory exists
if (!existsSync(WEB_APP_PUBLIC_DIR)) {
  mkdirSync(WEB_APP_PUBLIC_DIR, { recursive: true });
}

// Copy registry to web app
const targetDir = join(WEB_APP_PUBLIC_DIR, "r");
cpSync(registryDir, targetDir, { recursive: true, force: true });

console.log(`✅ Registry copied to ${targetDir}`);
console.log("🌐 The registry is now available in the web app!");
