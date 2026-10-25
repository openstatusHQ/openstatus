#!/usr/bin/env node
// Record a terminal session — the openstatus CLI, curl against the API — as
// data for scripts/videos. Each command is typed into a headless xterm, run
// for real in a pseudo-terminal against the local stack, and its output kept
// as timed screen snapshots, colors and spinners included.
//
//   node scripts/record-terminal.mjs cli-incident
//   node scripts/record-terminal.mjs --list
//
// Casts live in scripts/casts/<name>.mjs: a `meta` export (the same contract
// as scripts/tutorials) and a default function of steps. Needs
// `node scripts/dev-stack.mjs up --api`, and for CLI casts the openstatus
// binary on PATH or at --cli. Writes
// .recordings/remotion/<name>/{timeline.json,terminal.json}.

import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const castsDir = join(repo, "scripts", "casts");

const BOOLEAN_FLAGS = new Set(["list"]);
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

const available = readdirSync(castsDir, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".mjs"))
  .map((f) => f.name.slice(0, -4));
if (flags.list || names.length !== 1 || !available.includes(names[0])) {
  console.error(
    `usage: record-terminal.mjs <cast> [--cli path/to/openstatus] [--api http://localhost:3000] [--cols 104 --rows 24] [--out .recordings]\ncasts: ${available.join(", ")}`,
  );
  process.exit(flags.list ? 0 : 2);
}
const name = names[0];
const api = (flags.api ?? "http://localhost:3000").replace(/\/$/, "");
const db = flags.db ?? "http://127.0.0.1:8080";
for (const url of [api, db])
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    fail(`refusing non-local ${url}: casts write to the stack they run on`);
const positive = (key, fallback) => {
  const value = Number(flags[key] ?? fallback);
  if (!Number.isInteger(value) || value <= 0)
    fail(`--${key} must be a positive integer, got ${flags[key]}`);
  return value;
};
const cols = positive("cols", 104);
const rows = positive("rows", 24);
const out = resolve(flags.out ?? ".recordings");

let cast;
try {
  cast = await import(pathToFileURL(join(castsDir, `${name}.mjs`)).href);
} catch (e) {
  fail(`cast ${name} does not load: ${e.message}`);
}
const { validateMeta } = await import(
  pathToFileURL(join(repo, "scripts", "tutorials", "lib", "meta.mjs")).href
);
const problems = validateMeta(cast.meta, name);
if (problems.length) fail(problems.join("\n"));
const ping = await fetch(`${api}/ping`).catch(() => null);
if (!ping || ping.status >= 500)
  fail(
    `${name} needs the API, nothing healthy answers at ${api}: run node scripts/dev-stack.mjs up --api`,
  );

const { Terminal } = createRequire(
  join(repo, "scripts", "tutorials", "package.json"),
)("@xterm/headless");

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

// The commands run in a real shell with the API's local address and the
// development key: in development the API takes a key as its workspace id,
// and "1" is the seeded workspace.
const env = {
  ...process.env,
  PATH: [flags.cli ? dirname(resolve(flags.cli)) : null, process.env.PATH]
    .filter(Boolean)
    .join(delimiter),
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  OPENSTATUS_API_URL: api,
  OPENSTATUS_API_TOKEN: "1",
  OPENSTATUS_API_KEY: "1",
};

const term = new Terminal({ cols, rows, allowProposedApi: true });
const write = (data) => new Promise((done) => term.write(data, done));

// Video time in ms: typing and pauses advance it by fixed amounts, a
// command's output by the time it really took.
let now = 0;
let cursorVisible = true;
const events = [];
const styles = [];
const styleIds = new Map();
const frames = [];
let lastFrame = "";

function styleOf(cell) {
  const color = (palette, rgb, value) =>
    palette
      ? `p${value}`
      : rgb
        ? `#${value.toString(16).padStart(6, "0")}`
        : null;
  const style = {
    fg: color(cell.isFgPalette(), cell.isFgRGB(), cell.getFgColor()),
    bg: color(cell.isBgPalette(), cell.isBgRGB(), cell.getBgColor()),
    bold: Boolean(cell.isBold()),
    dim: Boolean(cell.isDim()),
    italic: Boolean(cell.isItalic()),
    underline: Boolean(cell.isUnderline()),
    inverse: Boolean(cell.isInverse()),
  };
  const key = JSON.stringify(style);
  if (!styleIds.has(key)) {
    styleIds.set(key, styles.length);
    styles.push(style);
  }
  return styleIds.get(key);
}

// The visible screen as rows of [text, style] runs; trailing blanks dropped.
function snapshot() {
  const buffer = term.buffer.active;
  const cell = buffer.getNullCell();
  const lines = [];
  for (let y = 0; y < rows; y++) {
    const line = buffer.getLine(buffer.viewportY + y);
    const runs = [];
    for (let x = 0; line && x < cols; x++) {
      line.getCell(x, cell);
      if (cell.getWidth() === 0) continue;
      const text = cell.getChars() || " ";
      const style = styleOf(cell);
      const last = runs.at(-1);
      if (last && last[1] === style) last[0] += text;
      else runs.push([text, style]);
    }
    while (
      runs.length &&
      /^ *$/.test(runs.at(-1)[0]) &&
      styles[runs.at(-1)[1]].bg === null
    )
      runs.pop();
    if (runs.length) runs[runs.length - 1][0] = runs.at(-1)[0].trimEnd() || " ";
    lines.push(runs);
  }
  const cursor = cursorVisible ? [buffer.cursorX, buffer.cursorY] : null;
  const key = JSON.stringify([lines, cursor]);
  if (key === lastFrame) return;
  lastFrame = key;
  frames.push({ t: now, lines, cursor });
}

async function show(data) {
  const shown = data.lastIndexOf("\x1b[?25h");
  const hidden = data.lastIndexOf("\x1b[?25l");
  if (shown !== hidden) cursorVisible = shown > hidden;
  await write(data);
  snapshot();
}

const PROMPT = "\x1b[90m~/acme\x1b[0m $ ";
// A steady hand: a little slower on spaces and punctuation, never random.
const keyDelay = (ch) => (/[\s"'/\\-]/.test(ch) ? 85 : 48);

async function type(text) {
  const t = now;
  for (const ch of text) {
    now += keyDelay(ch);
    await show(ch);
  }
  return t;
}

// The CLI asks the terminal for its background color and cursor position
// before it draws; a real terminal answers, so this one does too. A light
// background makes it pick its light-theme colors.
const ANSWERS = [
  ["\x1b]11;?", "\x1b]11;rgb:ffff/ffff/ffff\x1b\\"],
  ["\x1b[6n", "\x1b[1;1R"],
];

function execute(command) {
  return new Promise((done, failed) => {
    const child = spawn(
      "script",
      [
        "-q",
        "-e",
        "-E",
        "never",
        "-c",
        `stty cols ${cols} rows ${rows}; ${command}`,
        "/dev/null",
      ],
      { env, stdio: ["pipe", "pipe", "pipe"] },
    );
    const started = performance.now();
    const t0 = now;
    let output = "";
    let stderr = "";
    let queue = Promise.resolve();
    child.stdout.on("data", (chunk) => {
      const data = chunk.toString("utf8");
      const at = t0 + (performance.now() - started);
      for (const [ask, answer] of ANSWERS)
        if (data.includes(ask)) child.stdin.write(answer);
      output += data;
      queue = queue.then(() => {
        now = Math.max(now, at);
        return show(data);
      });
    });
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", failed);
    child.on("close", async (code) => {
      await queue;
      now = t0 + (performance.now() - started);
      child.stdin.destroy();
      if (code !== 0)
        failed(
          new Error(
            `\`${command}\` exited ${code}:\n${stripAnsi(output) || stderr}`,
          ),
        );
      else done(output);
    });
  });
}

// Escape codes are control characters, so these patterns must match them.
const stripAnsi = (text) =>
  text
    // oxlint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    // oxlint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "");

const log = (event) => events.push(event);

const rec = {
  sql,
  // Caption for what follows.
  step(label) {
    log({ type: "step", t: now, label });
  },
  async pause(ms) {
    now += ms;
    snapshot();
  },
  // The local API, for casts that show api.openstatus.dev but must call this.
  api,
  // Type `command` at the prompt and run it. An array is a multi-line command,
  // shown and run as written (end lines with \ to continue them). `paste`
  // drops it in a line at a time, the way a long curl gets pasted. `exec` runs
  // instead of what is shown. Returns the output without escape codes; a
  // non-zero exit fails the cast.
  async run(command, { exec, paste = false } = {}) {
    const lines = [command].flat();
    const t = now;
    for (const [i, line] of lines.entries()) {
      if (i > 0) await show("\r\n\x1b[90m>\x1b[0m ");
      if (paste) {
        now += 140;
        await show(line);
      } else await type(line);
    }
    log({
      type: "type",
      t,
      t1: now,
      box: [0, 0, 0, 0],
      text: lines.join("\n"),
    });
    now += paste ? 700 : 350;
    await show("\r\n");
    const t1 = now;
    const output = await execute(exec ?? lines.join("\n"));
    log({ type: "output", t: t1, t1: now });
    now += 300;
    await show(PROMPT);
    return stripAnsi(output);
  },
};

term.write(PROMPT);
await write("");
snapshot();
await rec.pause(900);
try {
  await cast.default(rec);
  await rec.pause(2000);
} catch (e) {
  console.error(`cast ${name} failed, nothing written: ${e.message}`);
  process.exit(1);
}

// Seconds, like the browser timelines.
const sec = (ms) => Math.round(ms) / 1000;
for (const f of frames) f.t = sec(f.t);
for (const e of events) {
  e.t = sec(e.t);
  if (e.t1 !== undefined) e.t1 = sec(e.t1);
}

const dir = join(out, "remotion", name);
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "terminal.json"),
  JSON.stringify({ cols, rows, styles, frames }),
);
writeFileSync(
  join(dir, "timeline.json"),
  JSON.stringify(
    {
      name,
      kind: "terminal",
      meta: cast.meta,
      theme: "light",
      fps: 30,
      // Character cells, not pixels: the video draws the terminal itself.
      viewport: { width: cols, height: rows },
      scale: 1,
      duration: sec(now),
      events,
    },
    null,
    2,
  ),
);
console.log(join(dir, "timeline.json"));
