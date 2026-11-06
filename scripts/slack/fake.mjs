// Loaded into the API server with --import (dev-stack up --api --fake-slack)
// so the Slack app runs end to end on a laptop: Slack's Web API, response
// URLs, Upstash Redis and the AI model are answered in this process, and every
// call the server makes is kept for scripts/record-slack.mjs. Nothing here
// touches the product code: the server builds its WebClients, Redis client and
// model calls on globalThis.fetch and the AI SDK's default provider, which are
// swapped below.
//
// Control (127.0.0.1:3099, for the recorder only):
//   POST /reset    {team, bot, users, channels, model}  start over
//   POST /message  {channel, user, text, thread_ts?}    a person posts
//   GET  /calls?after=<seq>                             what the server sent

import { createServer } from "node:http";

const SLACK = "https://slack.com/api/";
const RESPONSE_URL = "https://hooks.slack.local/";
const REDIS = process.env.UPSTASH_REDIS_REST_URL;
const CONTROL_PORT = Number(process.env.FAKE_SLACK_PORT ?? 3099);

let state;
function reset(setup = {}) {
  state = {
    team: setup.team ?? { id: "T_ACME", name: "Acme", domain: "acme" },
    bot: setup.bot ?? { id: "U_BOT", name: "openstatus" },
    users: new Map((setup.users ?? []).map((u) => [u.id, u])),
    channels: new Map(
      (setup.channels ?? []).map((c) => [c.id, { topic: "", ...c }]),
    ),
    messages: new Map(),
    model: setup.model ?? {},
    redis: new Map(),
    calls: [],
    seq: 0,
    clock: 1_800_000_000,
    created: 0,
  };
}
reset();

// Slack timestamps: unique, increasing, "seconds.micros".
const nextTs = () => `${++state.clock}.000100`;
const record = (method, args) => {
  const call = { seq: ++state.seq, at: Date.now(), method, args };
  state.calls.push(call);
  return call;
};
const messagesOf = (channel) => {
  if (!state.messages.has(channel)) state.messages.set(channel, []);
  return state.messages.get(channel);
};
const findMessage = (channel, ts) =>
  messagesOf(channel).find((m) => m.ts === ts);
const userObject = (id) => {
  const u = state.users.get(id) ?? { id, name: id, real_name: id };
  return {
    id: u.id,
    name: u.name,
    real_name: u.real_name,
    is_bot: id === state.bot.id,
    profile: {
      email: u.email,
      real_name: u.real_name,
      display_name: u.name,
      image_72: u.image,
    },
  };
};

// The Slack methods the app calls, answered the way Slack answers them.
const slack = {
  "auth.test": () => ({
    user_id: state.bot.id,
    team_id: state.team.id,
    team: state.team.name,
  }),
  "chat.postMessage": (a) => {
    const ts = nextTs();
    messagesOf(a.channel).push({
      ts,
      user: state.bot.id,
      text: a.text ?? "",
      blocks: a.blocks,
      thread_ts: a.thread_ts,
      reactions: [],
    });
    return { channel: a.channel, ts, message: { ts, text: a.text } };
  },
  "chat.update": (a) => {
    const m = findMessage(a.channel, a.ts);
    if (m) Object.assign(m, { text: a.text ?? m.text, blocks: a.blocks });
    return { channel: a.channel, ts: a.ts };
  },
  "chat.postEphemeral": () => ({ message_ts: nextTs() }),
  "chat.getPermalink": (a) => ({
    permalink: `https://${state.team.domain}.slack.com/archives/${a.channel}/p${String(a.message_ts).replace(".", "")}`,
  }),
  "conversations.create": (a) => {
    const id = `C_INC${++state.created}`;
    state.channels.set(id, { id, name: a.name, topic: "" });
    return { channel: { id, name: a.name, is_channel: true } };
  },
  "conversations.info": (a) => {
    const c = state.channels.get(a.channel) ?? {
      id: a.channel,
      name: a.channel,
    };
    return {
      channel: {
        id: c.id,
        name: c.name,
        is_channel: true,
        is_private: false,
        topic: { value: c.topic },
      },
    };
  },
  "conversations.setTopic": (a) => {
    const c = state.channels.get(a.channel);
    if (c) c.topic = a.topic;
    return {};
  },
  "conversations.history": (a) => {
    let list = messagesOf(a.channel).filter(
      (m) => !m.thread_ts || m.thread_ts === m.ts,
    );
    if (a.latest)
      list = list.filter((m) =>
        a.inclusive === "true" || a.inclusive === true
          ? Number(m.ts) <= Number(a.latest)
          : Number(m.ts) < Number(a.latest),
      );
    list = [...list].reverse().slice(0, Number(a.limit ?? 100));
    return { messages: list, has_more: false };
  },
  "conversations.replies": (a) => ({
    messages: messagesOf(a.channel).filter(
      (m) => m.ts === a.ts || m.thread_ts === a.ts,
    ),
    has_more: false,
  }),
  "conversations.invite": (a) => {
    const c = state.channels.get(a.channel);
    if (c)
      c.members = [
        ...new Set([...(c.members ?? []), ...String(a.users).split(",")]),
      ];
    return { channel: { id: a.channel, name: c?.name ?? a.channel } };
  },
  "conversations.archive": (a) => {
    const c = state.channels.get(a.channel);
    if (c) c.archived = true;
    return {};
  },
  "conversations.members": (a) => ({
    members: state.channels.get(a.channel)?.members ?? [...state.users.keys()],
  }),
  "reactions.get": (a) => ({
    type: "message",
    channel: a.channel,
    message: findMessage(a.channel, a.timestamp) ?? {
      ts: a.timestamp,
      reactions: [],
    },
  }),
  "reactions.add": (a) => {
    const m = findMessage(a.channel, a.timestamp);
    if (m) m.reactions.push({ name: a.name, users: [state.bot.id], count: 1 });
    return {};
  },
  "pins.add": (a) => {
    const m = findMessage(a.channel, a.timestamp);
    if (m) m.pinned = true;
    return {};
  },
  "users.info": (a) => ({ user: userObject(a.user) }),
  "views.open": () => ({ view: { id: `V${state.seq}` } }),
  "views.update": () => ({ view: { id: `V${state.seq}` } }),
};

// The WebClient posts form fields; nested values arrive as JSON strings.
function slackArgs(body) {
  const args = Object.fromEntries(new URLSearchParams(body ?? ""));
  for (const key of ["blocks", "attachments", "view", "metadata"])
    if (typeof args[key] === "string") args[key] = JSON.parse(args[key]);
  return args;
}

// Upstash's REST API: one command, or a list for /pipeline and /multi-exec.
// Strings come back base64-encoded when the client asks for it.
function redisCommand([command, key, ...rest]) {
  const r = state.redis;
  switch (command.toUpperCase()) {
    case "GET":
      return r.get(key) ?? null;
    case "SET": {
      const nx = rest.some((x) => String(x).toUpperCase() === "NX");
      if (nx && r.has(key)) return null;
      r.set(key, String(rest[0]));
      return "OK";
    }
    case "GETDEL": {
      const v = r.get(key) ?? null;
      r.delete(key);
      return v;
    }
    case "DEL":
      return [key, ...rest].filter((k) => r.delete(k)).length;
    case "EXISTS":
      return [key, ...rest].filter((k) => r.has(k)).length;
    case "INCR": {
      const v = Number(r.get(key) ?? 0) + 1;
      r.set(key, String(v));
      return v;
    }
    case "RPUSH": {
      const list = JSON.parse(r.get(key) ?? "[]");
      list.push(...rest.map(String));
      r.set(key, JSON.stringify(list));
      return list.length;
    }
    case "LRANGE": {
      const list = JSON.parse(r.get(key) ?? "[]");
      const [start, stop] = rest.map(Number);
      return list.slice(start, stop < 0 ? list.length + stop + 1 : stop + 1);
    }
    case "LTRIM": {
      const list = JSON.parse(r.get(key) ?? "[]");
      const [start, stop] = rest.map(Number);
      r.set(
        key,
        JSON.stringify(
          list.slice(start, stop < 0 ? list.length + stop + 1 : stop + 1),
        ),
      );
      return "OK";
    }
    case "EXPIRE":
    case "PEXPIRE":
      return r.has(key) ? 1 : 0;
    case "TTL":
      return r.has(key) ? 600 : -2;
    default:
      throw new Error(`fake redis: ${command} is not implemented`);
  }
}
const encode = (v) =>
  typeof v === "string" && v !== "OK"
    ? Buffer.from(v).toString("base64")
    : Array.isArray(v)
      ? v.map(encode)
      : v;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : (input.url ?? String(input));
  if (url.startsWith(SLACK)) {
    const method = url.slice(SLACK.length).split("?")[0];
    const args = slackArgs(
      typeof init.body === "string" ? init.body : undefined,
    );
    const call = record(method, args);
    // Answered as Slack answers an unknown method, so the app's WebClient
    // throws and a flow that needs a new method fails instead of passing.
    if (!slack[method]) {
      console.error(`fake slack: ${method} is not implemented`);
      call.result = { error: "unknown_method" };
      return json({ ok: false, error: "unknown_method" });
    }
    const answer = slack[method](args) ?? {};
    call.result = answer;
    return json({ ok: true, ...answer });
  }
  if (url.startsWith(RESPONSE_URL)) {
    record("response_url", JSON.parse(init.body ?? "{}"));
    return json({ ok: true });
  }
  if (REDIS && url.startsWith(REDIS)) {
    const path = url.slice(REDIS.length).replace(/^\//, "");
    const body = JSON.parse(init.body ?? "[]");
    const base64 =
      new Headers(init.headers).get("upstash-encoding") === "base64";
    const run = (cmd) => {
      try {
        const result = redisCommand(cmd);
        return { result: base64 ? encode(result) : result };
      } catch (e) {
        return { error: e.message };
      }
    };
    if (path === "pipeline" || path === "multi-exec")
      return json(body.map(run));
    return json(run(body));
  }
  return realFetch(input, init);
};

// Every model call answers from the recorder's script: the status-report
// draft as JSON, anything else (the postmortem) as text.
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const model = (modelId) => ({
  specificationVersion: "v4",
  provider: "fake",
  modelId,
  supportedUrls: {},
  async doGenerate(options) {
    const wantsJson = options.responseFormat?.type === "json";
    record("model", { modelId, json: wantsJson });
    const text = wantsJson
      ? JSON.stringify(state.model.draft ?? {})
      : (state.model.text ?? "");
    return {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    };
  },
  async doStream() {
    throw new Error("fake model: streaming is not used by these flows");
  },
});
globalThis.AI_SDK_DEFAULT_PROVIDER = {
  specificationVersion: "v4",
  languageModel: model,
  embeddingModel() {
    throw new Error("fake model: no embeddings");
  },
  imageModel() {
    throw new Error("fake model: no images");
  },
};

const readBody = (req) =>
  new Promise((done, fail) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        done(body ? JSON.parse(body) : {});
      } catch (e) {
        fail(e);
      }
    });
  });

createServer(async (req, res) => {
  const url = new URL(req.url, "http://control");
  const send = (body) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  // A bad body must not take the API server down with it.
  let body;
  if (req.method === "POST")
    try {
      body = await readBody(req);
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  if (req.method === "POST" && url.pathname === "/reset") {
    reset(body);
    return send({ ok: true });
  }
  if (req.method === "POST" && url.pathname === "/message") {
    const m = body;
    const ts = nextTs();
    messagesOf(m.channel).push({
      ts,
      user: m.user,
      text: m.text,
      thread_ts: m.thread_ts,
      reactions: [],
    });
    return send({ ok: true, ts });
  }
  if (req.method === "GET" && url.pathname === "/calls") {
    const after = Number(url.searchParams.get("after") ?? 0);
    return send({ calls: state.calls.filter((c) => c.seq > after) });
  }
  res.writeHead(404);
  res.end();
}).listen(CONTROL_PORT, "127.0.0.1");
