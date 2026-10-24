#!/usr/bin/env node
// Record a scripted walkthrough of the local dashboard as a video, with a
// visible cursor and click ripples, through Playwright.
//
//   node scripts/record.mjs create-status-page
//   node scripts/record.mjs create-status-page --theme dark
//   node scripts/record.mjs create-status-page --remotion
//   node scripts/record.mjs --list
//
// Tutorials live in scripts/tutorials/<name>.mjs. Needs the seeded stack from
// `node scripts/dev-stack.mjs up`; writes .recordings/<name>[.dark].mp4.
// --remotion captures at 2x without the in-page cursor and writes
// .recordings/<name>[.dark]/{video.mp4,timeline.json} for scripts/videos.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
    `usage: record.mjs <tutorial> [--theme light|dark] [--remotion] [--scale 1] [--no-cursor] [--base url] [--width 1440 --height 900] [--speed 1]\ntutorials: ${available.join(", ")}`,
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
const remotion = Boolean(flags.remotion);
const scale = Number(flags.scale ?? (remotion ? 2 : 1));
const showCursor = !remotion && !flags["no-cursor"];
const fps = 30;
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

const hideDevChrome = () => {
  const mount = () => {
    const style = document.createElement("style");
    style.textContent = `nextjs-portal, [data-slot=tailwind-indicator] { display: none !important; }`;
    document.head.appendChild(style);
  };
  if (document.head) mount();
  else addEventListener("DOMContentLoaded", mount);
};

// Fake cursor: headless capture has none. Position survives full navigations.
const cursorScript = () => {
  const mount = () => {
    if (document.getElementById("__rec-cursor")) return;
    const style = document.createElement("style");
    style.textContent = `
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
// Chromium ignores HTTPS_PROXY; external images (avatars, favicons) need it.
const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
// The headless shell screencasts at 1x unless the scale factor is forced.
const browser = await chromium.launch({
  args: [`--force-device-scale-factor=${scale}`],
  ...(proxy && { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } }),
});
const tmp = join(out, `.tmp-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const context = await browser.newContext({
  baseURL: base,
  viewport: { width, height },
  deviceScaleFactor: scale,
  colorScheme: theme,
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
await context.addInitScript(hideDevChrome);
if (showCursor) await context.addInitScript(cursorScript);

const page = await context.newPage();
let mouse = { x: width / 2, y: height / 2 };

// CDP screencast instead of Playwright's video: full-resolution frames whose
// timestamps share the wall clock with the timeline events below.
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = join(tmp, `f${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 92,
  maxWidth: width * scale,
  maxHeight: height * scale,
});

const now = () => Date.now() / 1000;
const events = [];
const log = (event) => events.push(event);
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame())
    log({ type: "nav", t: now(), url: frame.url() });
});

const wait = (ms) => page.waitForTimeout(ms / speed);

// Glide to the element's centre, so the viewer can follow the hand.
async function moveTo(locator) {
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const distance = Math.hypot(target.x - mouse.x, target.y - mouse.y);
  const t = now();
  await page.mouse.move(target.x, target.y, {
    steps: Math.max(10, Math.round(distance / 12)),
  });
  log({
    type: "move",
    t,
    t1: now(),
    from: [mouse.x, mouse.y],
    to: [target.x, target.y],
  });
  mouse = target;
  return box;
}

const rect = (box) => [box.x, box.y, box.width, box.height];

// A broken image in a tutorial is worse than no tutorial: fail the run.
async function settle() {
  await page.waitForFunction(
    () => [...document.images].every((img) => img.complete),
    null,
    { timeout: 15000 },
  );
  // Off-canvas panels (collapsed right sidebar) keep their images in the DOM,
  // shifted sideways; below-the-fold images still count, a scroll shows them.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((img) => {
        if (img.naturalWidth !== 0) return false;
        if (!img.checkVisibility({ visibilityProperty: true })) return false;
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.right > 0 && r.left < innerWidth;
      })
      .map((img) => img.currentSrc || img.src),
  );
  if (broken.length)
    throw new Error(
      `images failed to load:\n  ${[...new Set(broken)].join("\n  ")}`,
    );
}

const rec = {
  page,
  sql,
  wait,
  moveTo,
  settle,
  async goto(path) {
    await page.goto(path, { waitUntil: "networkidle" });
    await settle();
  },
  async click(locator) {
    const box = await moveTo(locator);
    await wait(250);
    log({ type: "click", t: now(), at: [mouse.x, mouse.y], box: rect(box) });
    await page.mouse.down();
    await wait(80);
    await page.mouse.up();
    await wait(400);
  },
  async type(locator, text) {
    await rec.click(locator);
    const t = now();
    await locator.pressSequentially(text, { delay: 70 / speed });
    const box = await locator.boundingBox();
    log({ type: "type", t, t1: now(), box: rect(box), text });
    await wait(300);
  },
  // Caption for what follows; ignored by the plain MP4.
  step(label) {
    log({ type: "step", t: now(), label });
  },
  // Compile routes in Next dev before the camera rolls, not mid-click.
  async warm(paths) {
    for (const path of paths) await context.request.get(path);
  },
  // Mark where the video starts; everything before (login, first load) is cut.
  async start() {
    await settle();
    rec.startAt = now();
  },
};

const tutorial = await import(join(tutorialsDir, `${name}.mjs`));
let failed = null;
try {
  await tutorial.default(rec);
} catch (e) {
  failed = e;
  await page
    .screenshot({ path: join(out, `${name}.failure.png`) })
    .catch(() => {});
}
await cdp.send("Page.stopScreencast").catch(() => {});
const endAt = now();
await context.close();
await browser.close();

if (failed) {
  rmSync(tmp, { recursive: true, force: true });
  console.error(`tutorial ${name} failed, no video written: ${failed.message}`);
  console.error(`last frame: ${join(out, `${name}.failure.png`)}`);
  process.exit(1);
}

// Variable-rate frames → constant-rate video: each frame holds until the next.
// The frame showing at start() opens the video; earlier ones are cut.
const startAt = rec.startAt ?? frames[0]?.t ?? endAt;
const opening = frames.findLastIndex((f) => f.t <= startAt);
const shown = frames.slice(Math.max(opening, 0));
const lines = shown.flatMap((f, i) => {
  const next = shown[i + 1]?.t ?? endAt;
  return [
    `file '${f.file}'`,
    `duration ${(next - Math.max(f.t, startAt)).toFixed(4)}`,
  ];
});
lines.push(`file '${shown.at(-1).file}'`);
const list = join(tmp, "frames.txt");
writeFileSync(list, lines.join("\n"));

const stem = `${name}${theme === "dark" ? ".dark" : ""}`;
const dir = remotion ? join(out, stem) : out;
mkdirSync(dir, { recursive: true });
const file = remotion ? join(dir, "video.mp4") : join(dir, `${stem}.mp4`);
const ffmpeg = spawnSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  list,
  "-vf",
  `fps=${fps},format=yuv420p`,
  "-c:v",
  "libx264",
  "-crf",
  remotion ? "14" : "18",
  "-movflags",
  "+faststart",
  file,
]);
rmSync(tmp, { recursive: true, force: true });
if (ffmpeg.error || ffmpeg.status !== 0) {
  console.error(
    `ffmpeg failed: ${ffmpeg.error?.message ?? ffmpeg.stderr?.toString()}`,
  );
  process.exit(1);
}

if (remotion) {
  const timeline = {
    name,
    theme,
    fps,
    viewport: { width, height },
    scale,
    duration: endAt - startAt,
    events: events
      .filter((e) => e.t >= startAt)
      .map((e) => ({
        ...e,
        t: e.t - startAt,
        ...(e.t1 !== undefined && { t1: e.t1 - startAt }),
      })),
  };
  writeFileSync(join(dir, "timeline.json"), JSON.stringify(timeline, null, 2));
}
console.log(file);
