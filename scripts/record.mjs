#!/usr/bin/env node
// Record a scripted walkthrough of the local dashboard as a video, with a
// visible cursor and click ripples, through Playwright.
//
//   node scripts/record.mjs create-status-page
//   node scripts/record.mjs create-status-page --theme dark
//   node scripts/record.mjs --list
//
// Tutorials live in scripts/tutorials/<name>.mjs. Needs the seeded stack from
// `node scripts/dev-stack.mjs up`; writes .recordings/<name>[.dark].mp4.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tutorialsDir = join(repo, "scripts", "tutorials");

const args = process.argv.slice(2);
const flags = {};
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) flags[a.slice(2)] = true;
    else flags[a.slice(2)] = args[++i];
  } else names.push(a);
}

const available = readdirSync(tutorialsDir)
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => f.slice(0, -4));
if (flags.list || names.length !== 1 || !available.includes(names[0])) {
  console.error(
    `usage: record.mjs <tutorial> [--theme light|dark] [--base url] [--width 1440 --height 900] [--speed 1]\ntutorials: ${available.join(", ")}`,
  );
  process.exit(flags.list ? 0 : 2);
}
const name = names[0];
const base = (flags.base ?? "http://localhost:3001").replace(/\/$/, "");
const db = flags.db ?? "http://127.0.0.1:8080";
const theme = flags.theme === "dark" ? "dark" : "light";
const width = Number(flags.width ?? 1440);
const height = Number(flags.height ?? 900);
const speed = Number(flags.speed ?? 1);
const out = resolve(flags.out ?? ".recordings");

// The repo pins playwright in apps/screenshot-service; a global install also works.
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const req = createRequire(
      join(repo, "apps/screenshot-service/package.json"),
    );
    return req("playwright");
  }
}

async function sql(statements) {
  const res = await fetch(db, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ statements }),
  });
  if (!res.ok) throw new Error(`sqld ${res.status} at ${db}`);
  return (await res.json()).map((r) => {
    if (r.error) throw new Error(r.error.message);
    return r.results;
  });
}

const probe = await fetch(`${base}/login`).catch(() => null);
if (probe?.status !== 200) {
  console.error(
    `no dashboard at ${base} (${probe?.status ?? "unreachable"}); run node scripts/dev-stack.mjs up`,
  );
  process.exit(1);
}

// Fake cursor: headless video has none. Position survives full navigations.
const cursorScript = () => {
  const mount = () => {
    if (document.getElementById("__rec-cursor")) return;
    const style = document.createElement("style");
    style.textContent = `
      nextjs-portal, [data-slot=tailwind-indicator] { display: none !important; }
      #__rec-cursor { position: fixed; z-index: 2147483647; pointer-events: none;
        width: 22px; height: 22px; margin: -3px 0 0 -4px;
        transition: transform 120ms ease-out; filter: drop-shadow(0 1px 2px rgb(0 0 0 / .35)); }
      #__rec-cursor.down { transform: scale(.85); }
      .__rec-ripple { position: fixed; z-index: 2147483646; pointer-events: none;
        width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 9999px;
        background: rgb(59 130 246 / .35); animation: __rec-ripple 450ms ease-out forwards; }
      @keyframes __rec-ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }`;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "__rec-cursor";
    cursor.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l16 10.5-7 1.5 4 7.5-3 1.5-4-7.5L4 20z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    const [x, y] = JSON.parse(
      sessionStorage.getItem("__rec-pos") ?? "[-50,-50]",
    );
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    document.body.appendChild(cursor);
    addEventListener(
      "mousemove",
      (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        sessionStorage.setItem(
          "__rec-pos",
          JSON.stringify([e.clientX, e.clientY]),
        );
      },
      true,
    );
    addEventListener(
      "mousedown",
      (e) => {
        cursor.classList.add("down");
        const r = document.createElement("div");
        r.className = "__rec-ripple";
        r.style.left = `${e.clientX}px`;
        r.style.top = `${e.clientY}px`;
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 500);
      },
      true,
    );
    addEventListener("mouseup", () => cursor.classList.remove("down"), true);
  };
  if (document.body) mount();
  else addEventListener("DOMContentLoaded", mount);
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const tmp = join(out, `.tmp-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const context = await browser.newContext({
  baseURL: base,
  viewport: { width, height },
  colorScheme: theme,
  recordVideo: { dir: tmp, size: { width, height } },
});
await context.addCookies([
  {
    name: "authjs.session-token",
    value: flags.token ?? "seed-session-max",
    url: base,
  },
  {
    name: "workspace-slug",
    value: flags.workspace ?? "love-openstatus",
    url: base,
  },
]);
await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
await context.addInitScript(cursorScript);

const page = await context.newPage();
const recordingStarted = Date.now();
let mouse = { x: width / 2, y: height / 2 };

const wait = (ms) => page.waitForTimeout(ms / speed);

// Glide to the element's centre, so the viewer can follow the hand.
async function moveTo(locator) {
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const distance = Math.hypot(target.x - mouse.x, target.y - mouse.y);
  await page.mouse.move(target.x, target.y, {
    steps: Math.max(10, Math.round(distance / 12)),
  });
  mouse = target;
}

const rec = {
  page,
  sql,
  wait,
  moveTo,
  async goto(path) {
    await page.goto(path, { waitUntil: "networkidle" });
  },
  async click(locator) {
    await moveTo(locator);
    await wait(250);
    await page.mouse.down();
    await wait(80);
    await page.mouse.up();
    await wait(400);
  },
  async type(locator, text) {
    await rec.click(locator);
    await locator.pressSequentially(text, { delay: 70 / speed });
    await wait(300);
  },
  // Compile routes in Next dev before the camera rolls, not mid-click.
  async warm(paths) {
    for (const path of paths) await context.request.get(path);
  },
  // Mark where the video starts; everything before (login, first load) is cut.
  start() {
    rec.startAt = (Date.now() - recordingStarted) / 1000;
  },
};

const tutorial = await import(join(tutorialsDir, `${name}.mjs`));
let failed = null;
try {
  await tutorial.default(rec);
} catch (e) {
  failed = e;
}
const video = page.video();
await context.close();
await browser.close();
const webm = await video.path();

const file = join(out, `${name}${theme === "dark" ? ".dark" : ""}`);
const ffmpeg = spawnSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  String(rec.startAt ?? 0),
  "-i",
  webm,
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-crf",
  "18",
  "-movflags",
  "+faststart",
  `${file}.mp4`,
]);
if (ffmpeg.error || ffmpeg.status !== 0) {
  renameSync(webm, `${file}.webm`);
  console.error("ffmpeg not available or failed; kept the untrimmed webm");
  console.log(`${file}.webm`);
} else console.log(`${file}.mp4`);
rmSync(tmp, { recursive: true, force: true });

if (failed) {
  console.error(`tutorial ${name} failed: ${failed.message}`);
  process.exit(1);
}
