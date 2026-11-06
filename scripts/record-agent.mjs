#!/usr/bin/env node
// Record an agent working through the openstatus MCP server as data for
// scripts/videos. The conversation is scripted; every tool call goes to the
// real /mcp endpoint on the local API, so a wrong tool name or argument fails
// the recording, and what is shown came back from the server. Which calls ask
// for approval follows the server's destructiveHint, not the script.
//
//   node scripts/record-agent.mjs incident-response
//   node scripts/record-agent.mjs --list
//
// Sessions live in scripts/agent/sessions/<name>.mjs: `meta` (the same contract
// as scripts/tutorials), `title`, `client` (the app's chrome), `tinybird` (rows for the monitoring pipes,
// which have no local instance) and a default function of steps. Needs
// `node scripts/dev-stack.mjs up --api --fake-tinybird`. Writes
// .recordings/remotion/agent-<name>/{timeline.json,agent.json}.

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sessionsDir = join(repo, "scripts", "agent", "sessions");

const args = process.argv.slice(2);
const flags = {};
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const next = args[i + 1];
    if (a === "--list" || next === undefined || next.startsWith("--"))
      flags[a.slice(2)] = true;
    else flags[a.slice(2)] = args[++i];
  } else names.push(a);
}
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const available = readdirSync(sessionsDir, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".mjs"))
  .map((f) => f.name.slice(0, -4));
if (flags.list || names.length !== 1 || !available.includes(names[0])) {
  console.error(
    `usage: record-agent.mjs <session> [--api http://localhost:3000] [--db http://127.0.0.1:8080] [--tinybird-port 3098] [--out .recordings]\nsessions: ${available.join(", ")}`,
  );
  process.exit(flags.list ? 0 : 2);
}
const name = names[0];
const api = (flags.api ?? "http://localhost:3000").replace(/\/$/, "");
const db = flags.db ?? "http://127.0.0.1:8080";
for (const url of [api, db])
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    fail(`refusing non-local ${url}: sessions write to the stack they run on`);
const tinybirdPort = Number(flags["tinybird-port"] ?? 3098);
const out = resolve(flags.out ?? ".recordings");

let session;
try {
  session = await import(pathToFileURL(join(sessionsDir, `${name}.mjs`)).href);
} catch (e) {
  fail(`session ${name} does not load: ${e.message}`);
}
const { validateMeta } = await import(
  pathToFileURL(join(repo, "scripts", "tutorials", "lib", "meta.mjs")).href
);
const problems = validateMeta(session.meta, name);
if (problems.length) fail(problems.join("\n"));

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

let rpc = 0;
// The key stands in for the seeded workspace, in development only.
async function mcp(method, params) {
  const res = await fetch(`${api}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-openstatus-key": "1",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpc, method, params }),
  });
  if (!res.ok)
    throw new Error(`/mcp answered ${res.status}: ${await res.text()}`);
  const text = await res.text();
  const event = text.split("\n").findLast((l) => l.startsWith("data: "));
  const body = JSON.parse(event ? event.slice(6) : text);
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

// Fixtures wipe and write, and a local port can hold a copy of production:
// both the database and the API must prove they are the seeded stack.
const seeded = await sql([
  "select count(*) from session where session_token = 'seed-session-max'",
]).catch(() => null);
if (!seeded) fail(`${name} needs sqld, nothing answers at ${db}`);
if (seeded[0].rows[0][0] === 0)
  fail(`refusing ${db}: it is not the seeded database`);
const ping = await fetch(`${api}/ping`).catch(() => null);
if (ping?.status !== 200)
  fail(
    `${name} needs the API, nothing healthy answers at ${api}: run node scripts/dev-stack.mjs up --api --fake-tinybird`,
  );
const { tools: toolList } = await mcp("tools/list", {});
const tools = new Map(toolList.map((t) => [t.name, t]));
const who = await mcp("tools/call", { name: "get_workspace", arguments: {} });
if (who.structuredContent?.slug !== "love-openstatus")
  fail(`refusing ${api}: its workspace 1 is not the seeded one`);

// The monitoring pipes' only source here; dev-stack points the API at it.
const pipes = session.tinybird ?? {};
const tinybird = createServer((req, res) => {
  const pipe = req.url?.match(/\/v0\/pipes\/([\w-]+)\.json/)?.[1];
  const data = pipes[pipe] ?? [];
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      meta: [],
      data,
      rows: data.length,
      statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 },
    }),
  );
});
await new Promise((done, failed) => {
  tinybird.once("error", failed);
  tinybird.listen(tinybirdPort, "127.0.0.1", done);
}).catch((e) =>
  fail(`port ${tinybirdPort} for the Tinybird fake: ${e.message}`),
);

// Video time in ms: fixed beats, never a call's real latency, so a retake
// lands on the same frames.
let now = 0;
const events = [];
const view = [];
const log = (event) => events.push(event);
const show = (event) => view.push({ t: now, ...event });
const keyDelay = (ch) => (/[\s,.:]/.test(ch) ? 80 : 45);
const CHAR = 13;
const CALL = 1000;
const APPROVAL = 2400;
const REVEAL = 3200;
let ids = 0;
let thumbnailAt = null;
let activity = null;

const rec = {
  sql,
  step(label) {
    log({ type: "step", t: now, label });
  },
  async pause(ms) {
    now += ms;
  },
  // Mark this moment as the thumbnail; without a call, the end is used.
  thumbnail() {
    thumbnailAt = now;
  },
  // The viewer types a message and sends it.
  async say(text) {
    const t = now;
    let typed = "";
    for (const ch of text) {
      typed += ch;
      now += keyDelay(ch);
      show({ op: "compose", text: typed });
    }
    log({ type: "type", t, t1: now, box: [0, 0, 0, 0], text });
    now += 300;
    show({ op: "compose", text: "" });
    show({ op: "message", id: ++ids, text });
    now += 700;
  },
  // The agent streams a reply. Numbers in it should come from `tool` results.
  async reply(text) {
    const t = now;
    now += text.length * CHAR;
    show({ op: "text", id: ++ids, t, t1: now, text });
    view.at(-1).t = t;
    log({ type: "output", t, t1: now });
    now += 500;
  },
  // Tool calls collapse into one section: "Tinkering…" while `steps` run, then
  // `label`. `open` has the viewer click it open afterwards.
  async activity(label, steps, { open = false } = {}) {
    const id = ++ids;
    show({ op: "activity", id, label });
    activity = id;
    const result = await steps();
    activity = null;
    show({ op: "settled", id });
    if (open) {
      const t = now;
      now += 1100;
      show({ op: "reveal", id });
      now += REVEAL;
      log({ type: "output", t, t1: now });
    }
    return result;
  },
  // The agent calls a tool on the real server and gets its structured output.
  // `summary` is its line once the section around it is opened.
  async tool(tool, input = {}, { summary } = {}) {
    const info = tools.get(tool);
    if (!info) throw new Error(`the server has no tool ${tool}`);
    const id = ++ids;
    const t = now;
    show({ op: "call", id, activity, name: tool, input });
    if (info.annotations?.destructiveHint) {
      show({ op: "approval", id });
      now += APPROVAL;
      show({ op: "allow", id });
      now += 400;
    }
    const result = await mcp("tools/call", { name: tool, arguments: input });
    if (result.isError)
      throw new Error(`${tool}: ${result.content?.[0]?.text ?? "failed"}`);
    now += CALL;
    const output = result.structuredContent;
    show({
      op: "result",
      id,
      summary: summary?.(output) ?? "Done",
    });
    log({ type: "output", t, t1: now });
    now += 900;
    return output;
  },
};

let recorded = false;
try {
  await session.default(rec);
  now += 2500;
  recorded = true;
} catch (e) {
  console.error(`session ${name} failed, nothing written: ${e.message}`);
  process.exitCode = 1;
}
tinybird.close();
if (recorded) {
  const sec = (ms) => Math.round(ms) / 1000;
  for (const e of view) {
    e.t = sec(e.t);
    if (e.t1 !== undefined) e.t1 = sec(e.t1);
  }
  for (const e of events) {
    e.t = sec(e.t);
    if (e.t1 !== undefined) e.t1 = sec(e.t1);
  }
  const slug = `agent-${name}`;
  const dir = join(out, "remotion", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "agent.json"),
    JSON.stringify(
      {
        title: session.title ?? "",
        client: session.client,
        toolCount: tools.size,
        events: view,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "timeline.json"),
    JSON.stringify(
      {
        name: slug,
        kind: "agent",
        meta: session.meta,
        theme: "light",
        fps: 30,
        viewport: { width: 1600, height: 1000 },
        scale: 1,
        duration: sec(now),
        thumbnail: { focus: null, t: sec(thumbnailAt ?? now) },
        events,
      },
      null,
      2,
    ),
  );
  console.log(join(dir, "timeline.json"));
}
