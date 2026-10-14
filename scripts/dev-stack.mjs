#!/usr/bin/env node
// Bring up (or tear down) what a dashboard screenshot needs: deno and sqld,
// the env files, a seeded libSQL on :8080 and the dashboard on :3001.
//
//   node scripts/dev-stack.mjs up [--reseed] [--warm /incidents/1 ...]
//   node scripts/dev-stack.mjs down
//   node scripts/dev-stack.mjs status
//   node scripts/dev-stack.mjs tools      # only fetch deno + sqld (session hook)
//
// Servers already answering on their port are reused and left alone by `down`;
// only processes this script started are stopped. Flags, ports and fixtures:
// .agents/skills/screenshot/SKILL.md.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stackDir = join(repo, ".screenshots", "stack");
const stateFile = join(stackDir, "state.json");
const toolsDir = join(repo, "node_modules", ".cache", "openstatus-tools");

// The sqld npm wrapper's postinstall is broken, so the platform tarball is
// unpacked by hand. Its binary reports the devbox-pinned sqld version.
const SQLD_NPM_VERSION = "0.24.1-pre.42";

const args = process.argv.slice(2);
const command = args.shift();
const flags = { warm: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--warm") {
    while (args[i + 1] && !args[i + 1].startsWith("--"))
      flags.warm.push(args[++i]);
  } else if (a.startsWith("--")) {
    const next = args[i + 1];
    flags[a.slice(2)] =
      next === undefined || next.startsWith("--") ? true : args[++i];
  }
}
if (!["up", "down", "status", "tools"].includes(command)) {
  console.error(
    "usage: dev-stack.mjs up [--reseed] [--warm <path> ...] [--port 3001] [--db-port 8080] | down | status | tools",
  );
  process.exit(2);
}

const port = Number(flags.port ?? 3001);
const dbPort = Number(flags["db-port"] ?? 8080);
const base = `http://localhost:${port}`;
const dbUrl = `http://127.0.0.1:${dbPort}`;

const log = (msg) => console.error(`dev-stack: ${msg}`);
const since = (t) => `${((Date.now() - t) / 1000).toFixed(1)}s`;

function pinnedVersion(name) {
  const devbox = JSON.parse(readFileSync(join(repo, "devbox.json"), "utf8"));
  const entry = devbox.packages.find((p) => p.startsWith(`${name}@`));
  if (!entry) throw new Error(`${name} is not pinned in devbox.json`);
  return entry.slice(name.length + 1);
}

function onPath(bin) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], {
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim().split("\n")[0] : null;
}

function ensureDeno() {
  const found = onPath("deno");
  if (found) return found;
  const version = pinnedVersion("deno");
  const bin = join(toolsDir, "node_modules", ".bin", "deno");
  if (existsSync(bin)) return bin;
  log(`fetching deno ${version} from npm into ${toolsDir}`);
  mkdirSync(toolsDir, { recursive: true });
  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      toolsDir,
      "--no-audit",
      "--no-fund",
      "--no-save",
      `deno@${version}`,
    ],
    { stdio: "inherit" },
  );
  return bin;
}

function ensureSqld() {
  const found = onPath("sqld");
  if (found) return found;
  const bin = join(toolsDir, "sqld", "sqld");
  if (existsSync(bin)) return bin;
  const os = { linux: "linux", darwin: "darwin" }[process.platform];
  const arch = { x64: "x64", arm64: "arm64" }[process.arch];
  if (!os || !arch)
    throw new Error(
      `no sqld npm build for ${process.platform}-${process.arch}; install sqld ${pinnedVersion("sqld")} yourself`,
    );
  log(
    `fetching sqld ${pinnedVersion("sqld")} (npm @sqld/${os}-${arch}@${SQLD_NPM_VERSION})`,
  );
  const tmp = mkdtempSync(join(tmpdir(), "sqld-"));
  const tarball = execFileSync(
    "npm",
    [
      "pack",
      `@sqld/${os}-${arch}@${SQLD_NPM_VERSION}`,
      "--pack-destination",
      tmp,
      "--silent",
    ],
    { encoding: "utf8" },
  ).trim();
  execFileSync("tar", ["xzf", join(tmp, tarball), "-C", tmp, "package/sqld"]);
  mkdirSync(dirname(bin), { recursive: true });
  renameSync(join(tmp, "package", "sqld"), bin);
  rmSync(tmp, { recursive: true, force: true });
  return bin;
}

function ensureEnvFiles() {
  for (const dir of ["apps/dashboard", "packages/db"]) {
    const target = join(repo, dir, ".env");
    if (!existsSync(target)) {
      copyFileSync(join(repo, dir, ".env.example"), target);
      log(`created ${dir}/.env from .env.example`);
    }
  }
}

async function sql(statements) {
  const res = await fetch(dbUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ statements }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json();
  return body.map((r) => {
    if (r.error) throw new Error(r.error.message);
    return r.results.rows;
  });
}

async function dashboardUp() {
  const res = await fetch(`${base}/login`, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  return res?.status === 200;
}

async function waitFor(check, what, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} did not come up within ${ms / 1000}s`);
}

function readState() {
  return existsSync(stateFile)
    ? JSON.parse(readFileSync(stateFile, "utf8"))
    : {};
}

function writeState(state) {
  mkdirSync(stackDir, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// Detached with its own process group, so `down` can stop pnpm, next and its
// workers together via the negative pid.
function launch(name, cmd, cmdArgs, opts) {
  const out = openSync(join(stackDir, `${name}.log`), "a");
  const child = spawn(cmd, cmdArgs, {
    ...opts,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  log(`started ${name} (pid ${child.pid}, log .screenshots/stack/${name}.log)`);
  return child.pid;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stop(name, pid) {
  if (!pid || !alive(pid)) return;
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        process.kill(pid, signal);
      } catch {
        return;
      }
    }
    const until = Date.now() + 5000;
    while (alive(pid) && Date.now() < until) spawnSync("sleep", ["0.2"]);
    if (!alive(pid)) break;
  }
  log(`stopped ${name} (pid ${pid})`);
}

async function up() {
  const started = Date.now();
  mkdirSync(stackDir, { recursive: true });
  const deno = ensureDeno();
  const sqld = ensureSqld();
  ensureEnvFiles();
  const toolPath = [dirname(deno), dirname(sqld), process.env.PATH].join(
    delimiter,
  );
  const state = readState();

  if (await sql(["select 1"])) {
    log(`reusing sqld at ${dbUrl}`);
  } else {
    state.sqld = launch("sqld", sqld, [
      "--db-path",
      join(stackDir, "openstatus-dev.db"),
      "--http-listen-addr",
      `127.0.0.1:${dbPort}`,
    ]);
    writeState(state);
    await waitFor(() => sql(["select 1"]), "sqld", 20000);
    log(`sqld answering after ${since(started)}`);
  }

  const env = {
    ...process.env,
    PATH: toolPath,
    DATABASE_URL: dbUrl,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN ?? "any-token",
  };
  const run = (script) => {
    const t = Date.now();
    const r = spawnSync("pnpm", ["--filter", "@openstatus/db", script], {
      cwd: repo,
      env,
      stdio: "inherit",
    });
    if (r.status !== 0)
      throw new Error(`pnpm --filter @openstatus/db ${script} failed`);
    log(`${script}: ${since(t)}`);
  };
  run("migrate");
  const [sessions] = (await sql([
    "select count(*) from session where session_token = 'seed-session-max'",
  ])) ?? [[[0]]];
  if (flags.reseed || sessions[0][0] === 0) run("seed");
  else
    log("seed present (seed-session-max); pass --reseed to reset the fixtures");

  if (await dashboardUp()) {
    log(`reusing dashboard at ${base}`);
  } else {
    state.dashboard = launch(
      "dashboard",
      "pnpm",
      ["--filter", "@openstatus/dashboard", "dev"],
      { cwd: repo, env: { ...env, PORT: String(port) } },
    );
    writeState(state);
    const t = Date.now();
    await waitFor(dashboardUp, "dashboard", 180000);
    log(`dashboard answering after ${since(t)}`);
  }

  // The first request to a route pays the Turbopack compile (10s+); do it here
  // so the screenshot's navigation never races a timeout.
  for (const path of flags.warm) {
    const t = Date.now();
    const res = await fetch(base + path, {
      headers: {
        cookie:
          "authjs.session-token=seed-session-max; workspace-slug=love-openstatus",
      },
      redirect: "manual",
    }).catch(() => null);
    log(`warmed ${path}: ${res?.status ?? "unreachable"} in ${since(t)}`);
  }
  log(`ready in ${since(started)}: dashboard ${base}, sqld ${dbUrl}`);
}

async function down() {
  const state = readState();
  stop("dashboard", state.dashboard);
  stop("sqld", state.sqld);
  if (!state.dashboard && !state.sqld)
    log("nothing started by this script is running");
  rmSync(stateFile, { force: true });
}

async function status() {
  const state = readState();
  console.log(
    `dashboard ${base}: ${(await dashboardUp()) ? "up" : "down"}${state.dashboard ? ` (pid ${state.dashboard}${alive(state.dashboard) ? "" : ", gone"})` : ""}`,
  );
  console.log(
    `sqld ${dbUrl}: ${(await sql(["select 1"])) ? "up" : "down"}${state.sqld ? ` (pid ${state.sqld}${alive(state.sqld) ? "" : ", gone"})` : ""}`,
  );
}

function tools() {
  console.log(`deno: ${ensureDeno()}`);
  console.log(`sqld: ${ensureSqld()}`);
}

try {
  await { up, down, status, tools }[command]();
} catch (e) {
  console.error(`dev-stack: ${e.message}`);
  process.exit(1);
}
