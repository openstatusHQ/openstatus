#!/usr/bin/env node
// Record a Slack thread — an incident declared, worked and closed from Slack —
// as data for scripts/videos. People's messages and clicks come from a script;
// everything the openstatus app posts is what the real API server sends, with
// Slack, Redis and the model answered by scripts/slack/fake.mjs.
//
//   node scripts/record-slack.mjs incident
//   node scripts/record-slack.mjs --list
//
// Threads live in scripts/slack/threads/<name>.mjs: `meta` (the same contract
// as scripts/tutorials), `people`, `channels`, the `model`'s scripted answers,
// and a default function of steps. Needs
// `node scripts/dev-stack.mjs up --fake-slack`. Writes
// .recordings/remotion/slack-<name>/{timeline.json,slack.json}.
//
// --dashboard also cuts to the dashboard where the thread calls
// dashboard("<export>"): the browser recorder (scripts/record.mjs) plays that
// export of the thread module against the same incident, with the browser's
// clock and the incident's rows set to the story's time, and the video plays
// those clips between the Slack parts. It writes
// .recordings/remotion/slack-<name>-dashboard/, the copy from `dashboardMeta`.

import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const threadsDir = join(repo, "scripts", "slack", "threads");

const args = process.argv.slice(2);
const flags = {};
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const next = args[i + 1];
    if (
      a === "--list" ||
      a === "--dashboard" ||
      next === undefined ||
      next.startsWith("--")
    )
      flags[a.slice(2)] = true;
    else flags[a.slice(2)] = args[++i];
  } else names.push(a);
}
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const available = readdirSync(threadsDir, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".mjs"))
  .map((f) => f.name.slice(0, -4));
if (flags.list || names.length !== 1 || !available.includes(names[0])) {
  console.error(
    `usage: record-slack.mjs <thread> [--dashboard] [--api http://localhost:3000] [--out .recordings]\nthreads: ${available.join(", ")}`,
  );
  process.exit(flags.list ? 0 : 2);
}
const name = names[0];
const api = (flags.api ?? "http://localhost:3000").replace(/\/$/, "");
const control = flags.control ?? "http://127.0.0.1:3099";
const db = flags.db ?? "http://127.0.0.1:8080";
for (const url of [api, control, db])
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    fail(`refusing non-local ${url}: threads write to the stack they run on`);
const out = resolve(flags.out ?? ".recordings");
// What dev-stack --fake-slack gives the server.
const SIGNING_SECRET = "local-slack-signing-secret";

let thread;
try {
  thread = await import(pathToFileURL(join(threadsDir, `${name}.mjs`)).href);
} catch (e) {
  fail(`thread ${name} does not load: ${e.message}`);
}
const { validateMeta } = await import(
  pathToFileURL(join(repo, "scripts", "tutorials", "lib", "meta.mjs")).href
);
const withDashboard = Boolean(flags.dashboard);
const meta = withDashboard ? thread.dashboardMeta : thread.meta;
const problems = validateMeta(
  meta,
  withDashboard ? `${name} (dashboardMeta)` : name,
);
if (problems.length) fail(problems.join("\n"));
const slug = withDashboard ? `slack-${name}-dashboard` : `slack-${name}`;
const dir = join(out, "remotion", slug);
if (withDashboard) {
  const probe = await fetch("http://localhost:3001/login").catch(() => null);
  if (probe?.status !== 200)
    fail(`--dashboard needs the dashboard at http://localhost:3001`);
}
const calls = await fetch(`${control}/calls`).catch(() => null);
if (!calls?.ok)
  fail(
    `${name} needs the API with the Slack fake, nothing answers at ${control}: run node scripts/dev-stack.mjs down, then up --fake-slack`,
  );

// A dashboard clip keeps the local servers idle for half a minute, longer
// than they keep a connection open: a request on a socket they closed never
// reached them, so it is sent once more on a fresh one.
async function request(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e.cause?.code !== "UND_ERR_SOCKET") throw e;
    return fetch(url, init);
  }
}

async function sql(statements) {
  const res = await request(db, {
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
const post = (path, body) =>
  request(`${control}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const { workspace } = await import(
  pathToFileURL(join(repo, "scripts", "tutorials", "lib", "fixtures.mjs")).href
);
const { team, people, channels, model } = thread;
const bot = { id: "U_BOT", name: "openstatus" };
const viewer = people[0];

// The app reads its install from the integration row: the bot token, the
// team, and every scope it asks for (else channel automation is skipped).
// The scopes are read from the source so this install cannot fall behind.
const scopes = [
  ...readFileSync(
    join(repo, "packages/services/src/integration/slack-scopes.ts"),
    "utf8",
  ).matchAll(/^\s+"([a-z_.:]+)",$/gm),
].map((m) => m[1]);
await sql([
  {
    q: `delete from integration where name = 'slack-agent' and workspace_id = ?`,
    params: [workspace],
  },
  { q: `delete from slack_user where workspace_id = ?`, params: [workspace] },
  {
    q: `insert into integration (name, workspace_id, credential, external_id, data) values ('slack-agent', ?, ?, ?, ?)`,
    params: [
      workspace,
      JSON.stringify({ botToken: "xoxb-fake", botUserId: bot.id }),
      team.id,
      JSON.stringify({
        teamId: team.id,
        teamName: team.name,
        appId: "A_OPENSTATUS",
        scopes: scopes.join(","),
        installedBy: viewer.id,
      }),
    ],
  },
  ...people.map((p) => ({
    q: `insert into slack_user (workspace_id, slack_team_id, slack_user_id, user_id) values (?, ?, ?, ?)`,
    params: [workspace, team.id, p.id, p.userId],
  })),
]);
await post("/reset", {
  team,
  bot,
  users: people.map((p) => ({
    id: p.id,
    name: p.name,
    real_name: p.realName,
    email: p.email,
  })),
  channels,
  model,
});
let seen = 0;

// Signed like Slack signs: v0=HMAC-SHA256("v0:<ts>:<body>").
async function toSlack(path, body, contentType) {
  const ts = Math.floor(Date.now() / 1000);
  const signature = `v0=${createHmac("sha256", SIGNING_SECRET).update(`v0:${ts}:${body}`).digest("hex")}`;
  const res = await request(`${api}/slack/${path}`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-slack-request-timestamp": String(ts),
      "x-slack-signature": signature,
    },
    body,
  });
  if (res.status >= 400)
    throw new Error(
      `/slack/${path} answered ${res.status}: ${await res.text()}`,
    );
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const form = (fields) => new URLSearchParams(fields).toString();

// The server answers Slack at once and does the work in the background:
// wait until its calls stop coming.
async function settle({ quiet = 700, max = 20000 } = {}) {
  const until = Date.now() + max;
  let last = Date.now();
  const fresh = [];
  while (Date.now() < until) {
    const { calls } = await request(`${control}/calls?after=${seen}`).then(
      (r) => r.json(),
    );
    if (calls.length) {
      fresh.push(...calls);
      seen = calls.at(-1).seq;
      last = Date.now();
    } else if (Date.now() - last > quiet) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  return fresh;
}

// Video time in ms, as in the terminal recorder.
let now = 0;
let clock = thread.clock ?? "10:00";

// The story happens yesterday (UTC) at the thread's clock. Each clock() call
// marks the wall time it was made, so a row the app wrote in between can be
// moved to the story's time: the mark's time plus the seconds since, capped.
// Story times sit before the recording started, so moving is idempotent.
const storyDay =
  Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate() - 1,
  ) / 1000;
const storyAt = (time) => {
  const [h, m] = time.split(":").map(Number);
  return storyDay + h * 3600 + m * 60;
};
const wallNow = () => Math.floor(Date.now() / 1000);
// The app names an incident's channel after the day it is declared; in the
// story, that is the story's day, which the dashboard clips show too.
const isoDay = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);
const onStoryDay = (text) =>
  text.replaceAll(isoDay(wallNow()), isoDay(storyDay));
const marks = [{ wall: wallNow(), story: storyAt(clock) }];
const RETIMED = {
  incident: [
    "declared_at",
    "started_at",
    "mitigated_at",
    "resolved_at",
    "closed_at",
    "created_at",
    "updated_at",
  ],
  incident_event: ["created_at"],
  incident_postmortem: [
    "approved_at",
    "published_at",
    "created_at",
    "updated_at",
  ],
};
async function retime() {
  const moved = (col) =>
    `case ${[...marks]
      .reverse()
      .map(
        (m) =>
          `when ${col} >= ${m.wall} then ${m.story} + min(${col} - ${m.wall}, 50)`,
      )
      .join(" ")} else ${col} end`;
  const scope = {
    incident: "workspace_id = ?",
    incident_event:
      "incident_id in (select id from incident where workspace_id = ?)",
    incident_postmortem:
      "incident_id in (select id from incident where workspace_id = ?)",
  };
  await sql(
    Object.entries(RETIMED).map(([table, cols]) => ({
      q: `update ${table} set ${cols.map((c) => `${c} = ${moved(c)}`).join(", ")} where ${scope[table]}`,
      params: [workspace],
    })),
  );
}
const inserts = [];
if (withDashboard) rmSync(dir, { recursive: true, force: true });
const events = [];
const view = [];
const log = (event) => events.push(event);
const show = (event) => view.push({ t: now, clock, ...event });
const keyDelay = (ch) => (/[\s,.:]/.test(ch) ? 80 : 45);
let triggers = 0;
let thumbnailAt = null;
let channel = channels[0].id;
const messages = new Map();

// What the app did, in the order it did it, a beat apart.
function replay(fresh) {
  const t = now;
  for (const call of fresh) {
    const { method, args } = call;
    const gap =
      { "chat.postMessage": 650, "chat.update": 350, response_url: 450 }[
        method
      ] ?? 120;
    if (method === "chat.postMessage") {
      now += gap;
      const ts = call.result?.ts;
      show({
        op: "post",
        channel: args.channel,
        user: bot.id,
        text: args.text,
        blocks: args.blocks,
        thread_ts: args.thread_ts,
        ts,
      });
    } else if (method === "chat.update") {
      now += gap;
      show({
        op: "update",
        channel: args.channel,
        ts: args.ts,
        text: args.text,
        blocks: args.blocks,
      });
    } else if (method === "chat.postEphemeral") {
      now += 450;
      show({
        op: "ephemeral",
        channel: args.channel,
        user: bot.id,
        text: args.text,
        blocks: args.blocks,
      });
    } else if (method === "response_url") {
      now += gap;
      show({
        op: "ephemeral",
        channel,
        user: bot.id,
        text: args.text,
        blocks: args.blocks,
      });
    } else if (method === "conversations.create") {
      now += gap;
      show({
        op: "channel",
        channel: call.result?.channel?.id,
        name: withDashboard ? onStoryDay(args.name) : args.name,
      });
    } else if (method === "conversations.setTopic") {
      show({ op: "topic", channel: args.channel, topic: args.topic });
    } else if (method === "conversations.archive") {
      now += gap;
      show({ op: "archive", channel: args.channel });
    } else if (method === "pins.add") {
      now += gap;
      show({ op: "pin", channel: args.channel, ts: args.timestamp });
    } else if (method === "reactions.add") {
      now += 350;
      show({
        op: "react",
        channel: args.channel,
        ts: args.timestamp,
        name: args.name,
        user: bot.id,
      });
    } else if (method === "views.open") {
      now += 500;
      show({ op: "modal", view: args.view });
    }
  }
  if (now > t) log({ type: "output", t, t1: now });
}

async function typeInComposer(text) {
  const t = now;
  let typed = "";
  for (const ch of text) {
    typed += ch;
    now += keyDelay(ch);
    show({ op: "compose", channel, text: typed });
  }
  log({ type: "type", t, t1: now, box: [0, 0, 0, 0], text });
  now += 250;
  show({ op: "compose", channel, text: "" });
}

const rec = {
  sql,
  viewer,
  step(label) {
    log({ type: "step", t: now, label });
  },
  async pause(ms) {
    now += ms;
  },
  // The wall clock shown on messages from here on, e.g. "10:12".
  clock(time) {
    clock = time;
    marks.push({ wall: wallNow(), story: storyAt(time) });
  },
  // With --dashboard, cut to the dashboard: record the thread's export
  // `clip` in the browser, a minute after the story's clock. Without, nothing.
  async dashboard(clip) {
    if (!withDashboard) return;
    await retime();
    const tmp = join(out, `.clip-${process.pid}`);
    const run = spawnSync(
      process.execPath,
      [
        join(repo, "scripts", "record.mjs"),
        join(threadsDir, `${name}.mjs`),
        "--export",
        clip,
        "--name",
        clip,
        "--clock",
        new Date((storyAt(clock) + 60) * 1000).toISOString(),
        "--remotion",
        "--out",
        tmp,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    if (run.status !== 0) throw new Error(`dashboard clip ${clip} failed`);
    mkdirSync(dir, { recursive: true });
    renameSync(join(tmp, "remotion", clip), join(dir, clip));
    rmSync(tmp, { recursive: true, force: true });
    inserts.push({ t: now, clip });
  },
  // Mark this moment as the thumbnail; without a call, the end is used.
  thumbnail() {
    thumbnailAt = now;
  },
  // The channel the app created last, e.g. the incident's.
  createdChannel() {
    const created = view.filter((e) => e.op === "channel").at(-1);
    if (!created) throw new Error("the app has not created a channel");
    return created.channel;
  },
  // Switch the viewer to another channel.
  async open(id) {
    channel = id;
    now += 300;
    show({ op: "open", channel: id });
    now += 500;
  },
  // Someone posts; the viewer types theirs into the composer first.
  async say(person, text) {
    if (person.id === viewer.id) await typeInComposer(text);
    else now += 600;
    const { ts } = await post("/message", { channel, user: person.id, text });
    messages.set(ts, { channel, user: person.id, text });
    show({ op: "post", channel, user: person.id, text, ts });
    now += 300;
    return ts;
  },
  // The viewer runs a slash command, e.g. "/openstatus incident declare …".
  async command(text) {
    await typeInComposer(text);
    const [cmd, ...rest] = text.split(" ");
    await toSlack(
      "commands",
      form({
        command: cmd,
        text: rest.join(" "),
        team_id: team.id,
        user_id: viewer.id,
        user_name: viewer.name,
        channel_id: channel,
        channel_name: channels.find((c) => c.id === channel)?.name ?? channel,
        response_url: `https://hooks.slack.local/commands/${++triggers}`,
        trigger_id: `trigger.${triggers}`,
      }),
      "application/x-www-form-urlencoded",
    );
    replay(await settle());
  },
  // The viewer clicks the button whose action_id matches, on the newest
  // message in the channel that has one.
  async click(actionId) {
    const message = [...view]
      .reverse()
      .find(
        (e) =>
          (e.op === "post" || e.op === "update") &&
          e.channel === channel &&
          buttons(e.blocks).some((b) => matches(b.action_id, actionId)),
      );
    if (!message) throw new Error(`no button ${actionId} in ${channel}`);
    const button = buttons(message.blocks).find((b) =>
      matches(b.action_id, actionId),
    );
    now += 500;
    show({ op: "press", channel, ts: message.ts, action_id: button.action_id });
    now += 300;
    await toSlack(
      "interactions",
      form({
        payload: JSON.stringify({
          type: "block_actions",
          team: { id: team.id },
          user: { id: viewer.id, name: viewer.name },
          channel: { id: channel },
          container: {
            type: "message",
            channel_id: channel,
            message_ts: message.ts,
          },
          message: {
            ts: message.ts,
            text: message.text,
            blocks: message.blocks,
          },
          trigger_id: `trigger.${++triggers}`,
          response_url: `https://hooks.slack.local/actions/${triggers}`,
          actions: [
            {
              type: "button",
              action_id: button.action_id,
              block_id: button.block_id,
              value: button.value,
              action_ts: String(Date.now() / 1000),
            },
          ],
        }),
      }),
      "application/x-www-form-urlencoded",
    );
    replay(await settle());
  },
  // The viewer fills the open modal and submits it: `values` maps a block id
  // to an option value (selects) or text (inputs, typed out on screen).
  async submit(values) {
    // The last modal event decides: one closed since is not open any more.
    const modal = [...view]
      .reverse()
      .find((e) => e.op === "modal" || e.op === "modal_close");
    if (modal?.op !== "modal") throw new Error("no modal is open");
    const state = {};
    for (const block of modal.view.blocks ?? []) {
      const element = block.element;
      if (!element || !(block.block_id in values)) continue;
      const value = values[block.block_id];
      const actionId = element.action_id;
      if (element.type === "plain_text_input") {
        const t = now;
        let typed = "";
        for (const ch of value) {
          typed += ch;
          now += keyDelay(ch);
          show({ op: "field", block_id: block.block_id, value: typed });
        }
        log({ type: "type", t, t1: now, box: [0, 0, 0, 0], text: value });
        state[block.block_id] = { [actionId]: { type: element.type, value } };
      } else {
        const option = element.options.find((o) => o.value === value);
        if (!option) throw new Error(`no option ${value} in ${block.block_id}`);
        now += 700;
        show({
          op: "field",
          block_id: block.block_id,
          value: option.text.text,
        });
        state[block.block_id] = {
          [actionId]: { type: element.type, selected_option: option },
        };
      }
      now += 300;
    }
    // Fields left as they opened (a preset severity) go along unchanged.
    for (const block of modal.view.blocks ?? []) {
      const element = block.element;
      if (!element || block.block_id in state || !element.initial_option)
        continue;
      state[block.block_id] = {
        [element.action_id]: {
          type: element.type,
          selected_option: element.initial_option,
        },
      };
    }
    now += 400;
    show({ op: "press", action_id: "submit" });
    now += 300;
    await toSlack(
      "interactions",
      form({
        payload: JSON.stringify({
          type: "view_submission",
          team: { id: team.id },
          user: { id: viewer.id, name: viewer.name },
          view: {
            id: "V_MODAL",
            callback_id: modal.view.callback_id,
            private_metadata: modal.view.private_metadata,
            state: { values: state },
          },
        }),
      }),
      "application/x-www-form-urlencoded",
    );
    show({ op: "modal_close" });
    replay(await settle());
  },
  // Someone reacts to a message, e.g. pushpin to add it to the timeline.
  async react(person, ts, reaction) {
    now += 700;
    show({ op: "react", channel, ts, name: reaction, user: person.id });
    await toSlack(
      "events",
      JSON.stringify({
        type: "event_callback",
        team_id: team.id,
        event_id: `Ev${Date.now()}${++triggers}`,
        event: {
          type: "reaction_added",
          user: person.id,
          reaction,
          item: { type: "message", channel, ts },
          event_ts: String(Date.now() / 1000),
        },
      }),
      "application/json",
    );
    replay(await settle());
  },
};

function buttons(blocks = []) {
  return blocks.flatMap((b) =>
    b.type === "actions"
      ? b.elements
          .filter((e) => e.type === "button")
          .map((e) => ({ ...e, block_id: b.block_id }))
      : b.accessory?.type === "button"
        ? [{ ...b.accessory, block_id: b.block_id }]
        : [],
  );
}
const matches = (id, wanted) =>
  wanted instanceof RegExp
    ? wanted.test(id)
    : id === wanted || id.startsWith(`${wanted}_`);

show({ op: "open", channel });
try {
  await thread.default(rec);
  // Hold on the end, unless the story ends on the dashboard: the video ends
  // on that clip then, not back in Slack.
  if (inserts.at(-1)?.t !== now) now += 2500;
} catch (e) {
  console.error(`thread ${name} failed, nothing written: ${e.message}`);
  process.exit(1);
}

const sec = (ms) => Math.round(ms) / 1000;
for (const e of view) e.t = sec(e.t);
for (const e of events) {
  e.t = sec(e.t);
  if (e.t1 !== undefined) e.t1 = sec(e.t1);
}
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "slack.json"),
  JSON.stringify(
    {
      team,
      viewer: viewer.id,
      bot,
      people: people.map(({ id, name, realName }) => ({ id, name, realName })),
      channels,
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
      kind: "slack",
      meta,
      theme: "light",
      fps: 30,
      viewport: { width: 1600, height: 1000 },
      scale: 1,
      duration: sec(now),
      thumbnail: { focus: null, t: sec(thumbnailAt ?? now) },
      events,
      ...(inserts.length && {
        inserts: inserts.map((i) => ({ ...i, t: sec(i.t) })),
      }),
    },
    null,
    2,
  ),
);
console.log(join(dir, "timeline.json"));
