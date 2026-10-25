#!/usr/bin/env node
// Record a scripted walkthrough of the local dashboard as a video, with a
// visible cursor and click ripples, through Playwright.
//
//   node scripts/record.mjs create-status-page
//   node scripts/record.mjs create-status-page --theme dark
//   node scripts/record.mjs create-status-page --remotion
//   node scripts/record.mjs --list
//
// Tutorials live in scripts/tutorials/<name>.mjs: a `meta` export and a
// default function of steps. Needs the seeded stack from
// `node scripts/dev-stack.mjs up`; writes .recordings/<name>[.dark].mp4.
// --remotion captures at 2x without the in-page cursor and writes
// .recordings/remotion/<name>/{video.mp4,timeline.json,thumbnail.png} for
// scripts/videos.
// Tutorials reset their own rows, so only a local database is accepted.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tutorialsDir = join(repo, "scripts", "tutorials");

const BOOLEAN_FLAGS = new Set(["remotion", "no-cursor", "list"]);
const args = process.argv.slice(2);
const flags = {};
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = args[i + 1];
    if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("--"))
      flags[key] = true;
    else flags[key] = args[++i];
  } else names.push(a);
}
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const available = readdirSync(tutorialsDir, { withFileTypes: true })
  .filter((f) => f.isFile())
  .map((f) => f.name)
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
if (!["localhost", "127.0.0.1"].includes(new URL(db).hostname))
  fail(`refusing non-local database ${db}: tutorials delete their own rows`);
const theme = flags.theme ?? "light";
if (theme !== "light" && theme !== "dark")
  fail(`--theme must be light or dark, got ${theme}`);
const positive = (key, fallback) => {
  const value = Number(flags[key] ?? fallback);
  if (!Number.isFinite(value) || value <= 0)
    fail(`--${key} must be a positive number, got ${flags[key]}`);
  return value;
};
const speed = positive("speed", 1);
const remotion = Boolean(flags.remotion);
// scripts/videos only has light compositions.
if (remotion && theme === "dark") fail("--remotion records light mode only");
const scale = positive("scale", remotion ? 2 : 1);
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

// Loaded before the browser starts, so a broken tutorial or a missing service
// fails in a second instead of half-way through a recording.
let tutorial;
try {
  tutorial = await import(
    pathToFileURL(join(tutorialsDir, `${name}.mjs`)).href
  );
} catch (e) {
  fail(`tutorial ${name} does not load: ${e.message}`);
}
const { validateMeta } = await import(
  pathToFileURL(join(tutorialsDir, "lib", "meta.mjs")).href
);
const problems = validateMeta(tutorial.meta, name);
if (problems.length) fail(problems.join("\n"));
// A tutorial may need a narrower window, e.g. for a card that runs wide.
const width = positive("width", tutorial.meta.viewport?.width ?? 1440);
const height = positive("height", tutorial.meta.viewport?.height ?? 900);
if (tutorial.meta.requires?.includes("checker")) {
  const checker = process.env.CHECKER_URL ?? "http://localhost:8090";
  const answer = await fetch(checker, {
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);
  if (!answer)
    fail(
      `${name} needs the checker, nothing answers at ${checker}: run apps/checker and start the dashboard with CHECKER_URL and CRON_SECRET (see the screenshot skill)`,
    );
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

const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

// Real wheel steps on an ease-in-out curve: the page glides instead of
// jumping, and the screencast catches every step.
// Paced by the clock, not a step count: each wheel call costs tens of ms.
async function wheel(dy) {
  const duration =
    (Math.min(1.2, Math.max(0.4, 0.35 + Math.abs(dy) / 2000)) * 1000) / speed;
  const started = Date.now();
  let done = 0;
  while (done !== dy) {
    const p = Math.min(1, (Date.now() - started) / duration);
    const next = p === 1 ? dy : dy * easeInOut(p);
    await page.mouse.wheel(0, next - done);
    done = next;
    await page.waitForTimeout(16);
  }
}

// Glide in a straight line and log it, so the Remotion cursor follows.
async function glide(x, y) {
  const distance = Math.hypot(x - mouse.x, y - mouse.y);
  const t = now();
  await page.mouse.move(x, y, {
    steps: Math.max(10, Math.round(distance / 12)),
  });
  log({ type: "move", t, t1: now(), from: [mouse.x, mouse.y], to: [x, y] });
  mouse = { x, y };
}

// Bring an element to the reading line by scrolling, never by a jump cut.
async function scrollTo(locator) {
  const margin = 96;
  for (let attempt = 0; attempt < 3; attempt++) {
    const box = await locator.boundingBox();
    if (!box) break;
    if (box.y >= margin && box.y + box.height <= height - margin) return;
    const dy = box.y + box.height / 2 - height * 0.45;
    // The wheel scrolls whatever is under the pointer: bring it over the
    // target's column first, so a sidebar or popover does not take the scroll.
    const x = Math.min(width - 24, Math.max(24, box.x + box.width / 2));
    if (Math.abs(x - mouse.x) > 48)
      await glide(x, Math.min(height - 120, Math.max(120, mouse.y)));
    const t = now();
    await wheel(dy);
    await page.waitForTimeout(150);
    log({ type: "scroll", t, t1: now(), dy });
    const after = await locator.boundingBox();
    if (!after || Math.abs(after.y - box.y) < 1) break;
  }
  // Nested scroll areas the wheel cannot reach still get there, abruptly.
  await locator.scrollIntoViewIfNeeded();
}

// Glide to the element's centre, so the viewer can follow the hand.
async function moveTo(locator) {
  await locator.waitFor({ state: "visible" });
  await scrollTo(locator);
  const box = await locator.boundingBox();
  await glide(box.x + box.width / 2, box.y + box.height / 2);
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
  // Fail the run unless the app confirms the action, e.g. a "Saved" toast.
  async expect(text) {
    await page.getByText(text, { exact: true }).first().waitFor();
  },
  // Caption for what follows; ignored by the plain MP4.
  step(label) {
    log({ type: "step", t: now(), label });
  },
  // Compile routes in Next dev before the camera rolls, not mid-click.
  async warm(paths) {
    for (const path of paths) await context.request.get(path);
  },
  // The still behind the video's thumbnail: this moment, without cursor or
  // toasts, keeping `focus` in frame. Without a call, the final state is used.
  async thumbnail(focus) {
    const box = focus ? await focus.boundingBox() : null;
    rec.thumb = {
      png: await page.screenshot({
        style:
          "#__rec-cursor, .__rec-ripple, [data-sonner-toaster] { display: none !important; }",
      }),
      focus: box && rect(box),
    };
  },
  // Open the first page and mark where the video starts; everything before
  // (login, first load, cleanup) is cut. The label is the opening caption.
  async start(path, label) {
    if (path) await rec.goto(path);
    await settle();
    rec.startAt = now();
    if (label) rec.step(label);
    await wait(1000);
  },
};
Object.assign(
  rec,
  (
    await import(pathToFileURL(join(tutorialsDir, "lib", "ui.mjs")).href)
  ).createUi(rec),
);

const stem = `${name}${theme === "dark" ? ".dark" : ""}`;
const failureShot = join(out, `${stem}.failure.png`);
rmSync(failureShot, { force: true });
let failed = null;
let shot = false;
try {
  await tutorial.default(rec);
  // Hold on the result: the last action's outcome (a posted update, a saved
  // form) lands after its confirmation toast, and the video ends here.
  await rec.settle();
  await rec.wait(2000);
  if (remotion && !rec.thumb) await rec.thumbnail();
} catch (e) {
  failed = e;
  shot = await page
    .screenshot({ path: failureShot })
    .then(() => true)
    .catch(() => false);
}
await cdp.send("Page.stopScreencast").catch(() => {});
const endAt = now();
await context.close();
await browser.close();

if (failed) {
  rmSync(tmp, { recursive: true, force: true });
  console.error(`tutorial ${name} failed, no video written: ${failed.message}`);
  if (shot) console.error(`last frame: ${failureShot}`);
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

const dir = remotion ? join(out, "remotion", stem) : out;
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
  rmSync(file, { force: true });
  console.error(
    `ffmpeg failed: ${ffmpeg.error?.message ?? ffmpeg.stderr?.toString()}`,
  );
  process.exit(1);
}

if (remotion) {
  const timeline = {
    name,
    meta: tutorial.meta,
    theme,
    fps,
    viewport: { width, height },
    scale,
    duration: endAt - startAt,
    thumbnail: { focus: rec.thumb?.focus ?? null },
    events: events
      .filter((e) => e.t >= startAt)
      .map((e) => ({
        ...e,
        t: e.t - startAt,
        ...(e.t1 !== undefined && { t1: e.t1 - startAt }),
      })),
  };
  writeFileSync(join(dir, "timeline.json"), JSON.stringify(timeline, null, 2));
  writeFileSync(join(dir, "thumbnail.png"), rec.thumb.png);
}
console.log(file);
