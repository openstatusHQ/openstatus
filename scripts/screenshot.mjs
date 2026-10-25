#!/usr/bin/env node
// Screenshot pages of a local Next.js dev server, desktop and mobile, through
// agent-browser (https://github.com/vercel-labs/agent-browser).
//
//   node scripts/screenshot.mjs --app dashboard /incidents/1 --selector "[data-slot=timeline]"
//   node scripts/screenshot.mjs --app web /pricing --full-page
//   node scripts/screenshot.mjs --app status-page /acme
//
// Flags, auth order and fixtures: .agents/skills/screenshot/SKILL.md.

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = {
  dashboard: { base: "http://localhost:3001", auth: true, probe: "/login" },
  web: { base: "http://localhost:3000", auth: false },
  // In dev the page slug is the first path segment: /acme, not acme.localhost.
  "status-page": { base: "http://localhost:3000", auth: false },
};

const BOOLEAN_FLAGS = new Set(["full-page"]);
const args = process.argv.slice(2);
const flags = {};
const paths = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = args[i + 1];
    if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith("--"))
      flags[key] = true;
    else flags[key] = args[++i];
  } else paths.push(a);
}
const app = APPS[flags.app ?? "dashboard"];
if (!app || paths.length === 0) {
  console.error(
    "usage: screenshot.mjs --app dashboard|web|status-page <path> [...] [--selector css] [--device both|desktop|mobile] [--theme light|dark|both]",
  );
  process.exit(2);
}

const base = (flags.base ?? app.base).replace(/\/$/, "");
const db = flags.db ?? "http://127.0.0.1:8080";
const out = resolve(flags.out ?? ".screenshots");
const themes =
  flags.theme === "both" || flags.theme === "dark"
    ? flags.theme === "both"
      ? ["light", "dark"]
      : ["dark"]
    : ["light"];
const width = Number(flags.width ?? 1400);
if (!Number.isFinite(width) || width <= 0) {
  console.error(`--width must be a positive number, got ${flags.width}`);
  process.exit(2);
}
// `emulate` sets the mobile user agent; the viewport line pins size and scale.
const DEVICES = {
  desktop: { width, height: 1000, scale: 2 },
  mobile: { width: 390, height: 844, scale: 3, emulate: "iPhone 14" },
};
const devices =
  flags.device === "desktop" || flags.device === "mobile"
    ? [flags.device]
    : ["desktop", "mobile"];
const wantsAuth = app.auth || Boolean(flags.token || flags.state);
mkdirSync(out, { recursive: true });

// agent-browser from PATH, else the copy `dev-stack.mjs tools` fetched.
const bin = (() => {
  const which = spawnSync("which", ["agent-browser"], { encoding: "utf8" });
  if (which.status === 0) return which.stdout.trim();
  const cached = join(
    repo,
    "node_modules/.cache/openstatus-tools/node_modules/.bin/agent-browser",
  );
  if (existsSync(cached)) return cached;
  console.error(
    "agent-browser not found: node scripts/dev-stack.mjs tools, or npm i -g agent-browser",
  );
  process.exit(1);
})();
const env = { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: "120000" };
// The cloud sandbox ships a Chromium that agent-browser does not find by itself.
if (
  !env.AGENT_BROWSER_EXECUTABLE_PATH &&
  existsSync("/opt/pw-browsers/chromium")
)
  env.AGENT_BROWSER_EXECUTABLE_PATH = "/opt/pw-browsers/chromium";

function ab(session, ...cmd) {
  const r = spawnSync(bin, ["--session", session, ...cmd], {
    encoding: "utf8",
    env,
  });
  if (r.status !== 0)
    throw new Error(
      `agent-browser ${cmd.join(" ")}: ${(r.stderr || r.stdout).trim()}`,
    );
  return r.stdout.trim();
}
// `eval` prints the result as JSON; page code returns JSON strings for objects.
function evalJs(session, js) {
  const v = JSON.parse(ab(session, "eval", js));
  return typeof v === "string" && v.startsWith("{") ? JSON.parse(v) : v;
}

async function sql(statements) {
  const res = await fetch(db, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ statements }),
  });
  if (!res.ok) throw new Error(`sqld ${res.status} at ${db}`);
  const body = await res.json();
  return body.map((r) => {
    if (r.error) throw new Error(r.error.message);
    const { columns, rows } = r.results;
    return rows.map((row) =>
      Object.fromEntries(columns.map((c, i) => [c, row[i]])),
    );
  });
}

// Session rows carry user_id only; the workspace cookie needs a slug the user
// belongs to, so both come from the same lookup.
async function sessionCookies() {
  const where = flags.user ? "and u.email = ?" : "";
  const params = flags.user ? [flags.user] : [];
  const [rows] = await sql([
    {
      q: `select s.session_token as token, u.id as user_id, u.email as email
          from session s join user u on u.id = s.user_id
          where s.expires > unixepoch() * 1000 ${where}
          order by s.expires desc, s.user_id limit 1`,
      params,
    },
  ]);
  if (rows.length === 0) return null;
  const { token, user_id, email } = rows[0];
  let slug = flags.workspace;
  if (!slug) {
    const [ws] = await sql([
      {
        q: `select w.slug as slug from users_to_workspaces m join workspace w on w.id = m.workspace_id
            where m.user_id = ? order by m.created_at, m.workspace_id limit 1`,
        params: [user_id],
      },
    ]);
    slug = ws[0]?.slug;
  }
  console.error(`auth: session of ${email}${slug ? ` in ${slug}` : ""}`);
  return cookies(token, slug);
}

function cookies(token, slug) {
  const list = [{ name: "authjs.session-token", value: token }];
  if (slug) list.push({ name: "workspace-slug", value: slug });
  return list;
}

// Three apps, two default ports, and on this machine any of them may sit on
// :3001. Only the dashboard titles /login "Sign In"; use that to tell them apart.
const probe = await fetch(base + (app.probe ?? paths[0])).catch(() => null);
if (!probe || probe.status === 404 || probe.status >= 500) {
  console.error(
    `nothing usable at ${base}${app.probe ?? paths[0]} (${probe?.status ?? "unreachable"}); start the ${flags.app ?? "dashboard"} dev server or pass --base`,
  );
  process.exit(1);
}
if (!app.auth) {
  const login = await fetch(`${base}/login`, { redirect: "manual" }).catch(
    () => null,
  );
  // a status page in dev answers /login too when a page has that slug
  const html =
    login?.status === 200 ? await login.text().catch(() => null) : "";
  if (html === null) {
    console.error(`could not read ${base}/login to identify the app; retry`);
    process.exit(1);
  }
  if (/<title>Sign In \|/.test(html)) {
    console.error(
      `${base} serves the dashboard, not ${flags.app}; pass --base`,
    );
    process.exit(1);
  }
}

let auth = null;
if (flags.token) {
  auth = cookies(flags.token, flags.workspace);
  console.error("auth: --token");
} else if (flags.state) {
  console.error(`auth: agent-browser state ${flags.state}`);
} else if (wantsAuth) {
  auth = await sessionCookies().catch(
    (e) => (console.error(`auth: ${e.message}`), null),
  );
  if (!auth)
    console.error(
      "auth: no session found; seed the database, pass --token, or --state <agent-browser state file>",
    );
}

// The first request to a route pays the dev server's compile (10s+ on a cold
// Turbopack cache); take it here so no browser command waits on it.
if (auth) {
  const headers = {
    cookie: auth.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  for (const path of paths) {
    const t = Date.now();
    const res = await fetch(base + path, { headers, redirect: "manual" }).catch(
      () => null,
    );
    console.error(
      `warm ${path}: ${res?.status ?? "unreachable"} in ${((Date.now() - t) / 1000).toFixed(1)}s`,
    );
  }
}

// Dev-only chrome floats over the page corners: the apps' Tailwind
// breakpoint badge, the Next.js dev indicator and the React Query devtools
// button.
const HIDE_DEV_CHROME = `(() => {
  const st = document.createElement("style");
  st.textContent = "[data-slot=tailwind-indicator],nextjs-portal,.tsqd-open-btn-container{display:none!important}";
  document.head.appendChild(st);
  return "ok";
})()`;

// agent-browser shoots viewports, not elements. Pin the k-th match to the
// viewport's top-left at its own size, hide everything else, and let the
// caller size the viewport to it.
const isolate = (selector, k) => `(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
  const el = els[${k}];
  if (!el) return JSON.stringify({ count: els.length });
  const r = el.getBoundingClientRect();
  const w = Math.ceil(r.width), h = Math.ceil(r.height);
  const st = document.createElement("style");
  st.id = "__shot";
  st.textContent = "html{background:" + getComputedStyle(document.body).backgroundColor + "!important}"
    + "body{visibility:hidden!important;overflow:hidden!important}"
    + "[data-shot-target]{visibility:visible!important;position:fixed!important;top:0!important;left:0!important;margin:0!important;width:" + w + "px!important;height:" + h + "px!important;z-index:2147483647!important}";
  el.setAttribute("data-shot-target", "");
  document.head.appendChild(st);
  return JSON.stringify({ count: els.length, w, h });
})()`;
const RESTORE = `(() => {
  document.getElementById("__shot")?.remove();
  document.querySelector("[data-shot-target]")?.removeAttribute("data-shot-target");
  return "ok";
})()`;

// next-themes follows prefers-color-scheme until the user picks a theme; a
// saved choice (from --state) would win, so pin the storage key too.
const pinTheme = (theme) => `(() => {
  localStorage.setItem("theme", ${JSON.stringify(theme)});
  return document.documentElement.classList.contains(${JSON.stringify(theme)}) ? "ok" : "reload";
})()`;

const LOADED = `document.readyState === "complete" && document.fonts.status === "loaded"`;

const written = [];
const runs = themes.flatMap((theme) =>
  devices.map((device) => ({ theme, device })),
);
for (const { theme, device } of runs) {
  // One isolated browser per run; sessions survive this process, so close it.
  const session = `openstatus-shot-${device}-${theme}-${process.pid}`;
  const d = DEVICES[device];
  const viewport = [String(d.width), String(d.height), String(d.scale)];
  const suffix = `.${device}${theme === "dark" ? ".dark" : ""}.png`;
  try {
    if (d.emulate) ab(session, "set", "device", d.emulate);
    ab(session, "set", "viewport", ...viewport);
    ab(session, "set", "media", theme);
    for (const c of auth ?? [])
      ab(session, "cookies", "set", c.name, c.value, "--url", base);
    for (const path of paths) {
      const open = flags.state ? ["--state", flags.state] : [];
      ab(session, ...open, "open", base + path);
      ab(session, "wait", "--fn", LOADED);
      const url = ab(session, "get", "url");
      if (
        app.auth &&
        new URL(url).pathname === "/login" &&
        !path.startsWith("/login")
      )
        throw new Error(`redirected to login for ${path}; auth failed`);
      if (evalJs(session, pinTheme(theme)) === "reload") {
        ab(session, "reload");
        ab(session, "wait", "--fn", LOADED);
      }
      evalJs(session, HIDE_DEV_CHROME);
      const name =
        path.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-") || "root";
      if (flags.selector) {
        let k = 0;
        for (;;) {
          const box = evalJs(session, isolate(flags.selector, k));
          if (!box.w) break;
          ab(
            session,
            "set",
            "viewport",
            String(box.w),
            String(box.h),
            String(d.scale),
          );
          const file = join(
            out,
            `${name}${box.count > 1 ? `-${k}` : ""}${suffix}`,
          );
          ab(session, "screenshot", file);
          written.push(file);
          evalJs(session, RESTORE);
          ab(session, "set", "viewport", ...viewport);
          if (++k >= box.count) break;
        }
        if (k === 0) {
          console.error(`no visible match for ${flags.selector} on ${path}`);
          process.exitCode = 1;
        }
      } else {
        const file = join(out, `${name}${suffix}`);
        ab(
          session,
          "screenshot",
          file,
          ...(flags["full-page"] ? ["--full"] : []),
        );
        written.push(file);
      }
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
    break;
  } finally {
    spawnSync(bin, ["--session", session, "close"], { env });
  }
}
writeGallery();
for (const f of written) console.log(f);

// A gallery of every PNG in the output directory, written as a page fragment
// (title + style + body) so the Artifact tool can publish it as is, with the
// PNGs passed as `files`. Browsers render the fragment fine locally too.
function writeGallery() {
  const shots = readdirSync(out)
    .filter((f) => f.endsWith(".png"))
    .map((f) => ({ file: f, mtime: statSync(join(out, f)).mtimeMs }));
  if (shots.length === 0) return;
  const groups = new Map();
  for (const s of shots) {
    const m = s.file.match(/^(.*)\.(desktop|mobile)(\.dark)?\.png$/);
    const key = m ? m[1] : s.file;
    const g = groups.get(key) ?? { key, shots: [], mtime: 0 };
    g.shots.push({
      ...s,
      device: m?.[2] ?? "",
      label: m ? `${m[2]}${m[3] ? " dark" : ""}` : s.file,
    });
    g.mtime = Math.max(g.mtime, s.mtime);
    groups.set(key, g);
  }
  const git = (...a) =>
    execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();
  const commit = git("rev-parse", "--short", "HEAD");
  const facts = [
    ["App", flags.app ?? "dashboard"],
    ["Branch", git("rev-parse", "--abbrev-ref", "HEAD")],
    ["Commit", commit],
    ["Taken", new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"],
    [
      "Viewport",
      devices
        .map((k) => `${k} ${DEVICES[k].width} px at ${DEVICES[k].scale}×`)
        .join(", ") + (flags["full-page"] ? ", full page" : ""),
    ],
  ];
  const esc = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const html = `<title>Screenshots ${esc(commit)}</title>
<style>
  :root { --bg: #f7f7f5; --fg: #1c1c1a; --muted: #6b6b66; --line: #dcdcd6; --panel: #ffffff; --accent: #c2410c; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #141413; --fg: #ecece8; --muted: #9c9c95; --line: #2d2d2a; --panel: #1d1d1b; --accent: #fb923c; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #141413; --fg: #ecece8; --muted: #9c9c95; --line: #2d2d2a; --panel: #1d1d1b; --accent: #fb923c; color-scheme: dark; }
  body { background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }
  main { max-width: 1120px; margin: 0 auto; padding-block: 32px 64px; padding-inline: 16px; display: grid; gap: 32px; }
  h1, h2 { margin: 0; font-weight: 600; text-wrap: balance; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1rem; font-family: ui-monospace, Menlo, monospace; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 20px; margin: 0; font-size: 0.875rem; font-family: ui-monospace, Menlo, monospace; border-block: 1px solid var(--line); padding-block: 10px; }
  dt { color: var(--muted); } dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  section { display: grid; gap: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; align-items: start; }
  figure { margin: 0; display: grid; gap: 8px; flex: 1 1 480px; min-width: 0; }
  figure.mobile { flex: 0 1 280px; }
  figcaption { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: var(--accent); }
  .frame { border: 1px solid var(--line); background: var(--panel); border-radius: 6px; overflow: hidden; }
  .frame img { display: block; width: 100%; height: auto; max-width: 100%; }
  @media (max-width: 480px) { dl { grid-template-columns: 1fr; gap: 0 } dt { margin-top: 8px } }
</style>
<main>
  <h1>Screenshots</h1>
  <dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
${[...groups.values()]
  .sort((a, b) => b.mtime - a.mtime)
  .map(
    (g) => `  <section>
    <h2>${esc(g.key)}</h2>
    <div class="row">
${g.shots
  .sort((a, b) => a.label.localeCompare(b.label))
  .map(
    (s) => `    <figure class="${esc(s.device)}">
      <figcaption>${esc(s.label)}</figcaption>
      <div class="frame"><img src="${esc(s.file)}" alt="${esc(g.key)} ${esc(s.label)}" loading="lazy"></div>
    </figure>`,
  )
  .join("\n")}
    </div>
  </section>`,
  )
  .join("\n")}
</main>
`;
  const index = join(out, "index.html");
  writeFileSync(index, html);
  console.error(`gallery: ${index}`);
}
