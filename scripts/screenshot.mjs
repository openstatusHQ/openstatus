#!/usr/bin/env node
// Screenshot pages of a local Next.js dev server, in light and dark.
//
//   node scripts/screenshot.mjs --app dashboard /incidents/1 --selector "[data-slot=timeline]"
//   node scripts/screenshot.mjs --app web /pricing --full-page
//   node scripts/screenshot.mjs --app status-page /acme
//
// Flags, auth order and fixtures: .agents/skills/screenshot/SKILL.md.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(
  join(repo, "apps/screenshot-service/package.json"),
)("playwright");

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
    "usage: screenshot.mjs --app dashboard|web|status-page <path> [...] [--selector css] [--theme both|light|dark]",
  );
  process.exit(2);
}

const base = (flags.base ?? app.base).replace(/\/$/, "");
const db = flags.db ?? "http://127.0.0.1:8080";
const out = resolve(flags.out ?? ".screenshots");
const themes =
  flags.theme === "light" || flags.theme === "dark"
    ? [flags.theme]
    : ["light", "dark"];
const width = Number(flags.width ?? 1400);
if (!Number.isFinite(width) || width <= 0) {
  console.error(`--width must be a positive number, got ${flags.width}`);
  process.exit(2);
}
const stateFile = resolve(flags.state ?? join(out, "state.json"));
const wantsAuth = app.auth || Boolean(flags.token || flags.login);
mkdirSync(out, { recursive: true });

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
  const host = new URL(base).hostname;
  const list = [
    { name: "authjs.session-token", value: token, domain: host, path: "/" },
  ];
  if (slug)
    list.push({ name: "workspace-slug", value: slug, domain: host, path: "/" });
  return list;
}

async function magicLinkLogin(context) {
  if (!flags.log) throw new Error("--login needs --log <dev server log file>");
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  // The form opens closed; the email input appears after the mode button.
  const input = page.locator('input[name="email"]');
  if (!(await input.isVisible()))
    await page.getByRole("button", { name: "Continue with email" }).click();
  await input.fill(flags.login);
  const seen = readFileSync(flags.log, "utf8").length;
  await input.press("Enter");
  let url;
  for (let i = 0; i < 40 && !url; i++) {
    await page.waitForTimeout(500);
    url = readFileSync(flags.log, "utf8")
      .slice(seen)
      .match(/Magic Link: (http\S+)/)?.[1];
  }
  if (!url) throw new Error("no `>>> Magic Link:` line appeared in the log");
  await page.goto(url, { waitUntil: "networkidle" });
  await page.close();
  await context.storageState({ path: stateFile });
  console.error(
    `auth: magic link for ${flags.login}, state saved to ${stateFile}`,
  );
}

// Three apps, two default ports, and on this machine any of them may sit on
// :3001. Only the dashboard serves a form at /login; use that to tell them apart.
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
  if (login?.status === 200) {
    console.error(
      `${base} serves the dashboard, not ${flags.app}; pass --base`,
    );
    process.exit(1);
  }
}

// System Chrome locally; a remote VM has none, so fall back to Playwright's
// bundled Chromium, and when that build is missing too (the cloud sandbox
// ships one Chromium under /opt/pw-browsers, usually not the pinned build) to
// an explicit executable.
const preinstalled = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/opt/pw-browsers/chromium",
].find((p) => p && existsSync(p));
const attempts = [
  ["chrome", () => chromium.launch({ channel: "chrome" })],
  ["bundled chromium", () => chromium.launch()],
  ...(preinstalled
    ? [[preinstalled, () => chromium.launch({ executablePath: preinstalled })]]
    : []),
];
let browser;
for (const [label, launch] of attempts) {
  browser = await launch().catch((e) => {
    console.error(`${label}: ${e.message.split("\n")[0]}`);
    return null;
  });
  if (browser) break;
}
if (!browser) {
  console.error(
    "no browser: cd apps/screenshot-service && npx playwright install chromium, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
  );
  process.exit(1);
}
let auth = null;
if (flags.token) {
  auth = cookies(flags.token, flags.workspace);
  console.error("auth: --token");
} else if (wantsAuth && !flags.login) {
  auth = await sessionCookies().catch(
    (e) => (console.error(`auth: ${e.message}`), null),
  );
}
// One login for all themes: the dashboard rate-limits magic-link emails.
if (flags.login && !auth) {
  const context = await browser.newContext();
  await magicLinkLogin(context);
  await context.close();
}
// A saved state is only a fallback; an explicit identity must not silently
// become whoever logged in last.
const useState =
  wantsAuth && !auth && !flags.user && !flags.token && existsSync(stateFile);
if (useState) console.error(`auth: saved state ${stateFile}`);
if (wantsAuth && !auth && !useState) {
  console.error(
    "auth: no session found; seed the database, pass --token, or --login <email> --log <file>",
  );
}

const written = [];
process.on("uncaughtException", async (e) => {
  console.error(e.message);
  await browser.close().catch(() => {});
  process.exit(1);
});
// The first request to a route pays the dev server's compile (10s+ on a cold
// Turbopack cache); take it here so the navigation below never races a timeout.
if (!useState) {
  const headers = auth
    ? { cookie: auth.map((c) => `${c.name}=${c.value}`).join("; ") }
    : {};
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
for (const theme of themes) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    ...(useState ? { storageState: stateFile } : {}),
  });
  if (auth) await context.addCookies(auth);
  // Every app uses next-themes with the default storage key.
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    if (
      app.auth &&
      new URL(page.url()).pathname === "/login" &&
      !path.startsWith("/login")
    )
      throw new Error(`redirected to login for ${path}; auth failed`);
    // Dev-only chrome floats over the bottom-left corner: the apps' Tailwind
    // breakpoint badge and the Next.js dev indicator.
    await page.addStyleTag({
      content:
        "[data-slot=tailwind-indicator],nextjs-portal{display:none!important}",
    });
    const name =
      path.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-") || "root";
    if (flags.selector) {
      const all = page.locator(flags.selector);
      const n = await all.count();
      let k = 0;
      for (let i = 0; i < n; i++) {
        const el = all.nth(i);
        if (!(await el.isVisible())) continue;
        await el.scrollIntoViewIfNeeded();
        const file = join(out, `${name}-${theme}${n > 1 ? `-${k}` : ""}.png`);
        await el.screenshot({ path: file });
        written.push(file);
        k++;
      }
      if (k === 0) {
        console.error(`no visible match for ${flags.selector} on ${path}`);
        process.exitCode = 1;
      }
    } else {
      const file = join(out, `${name}-${theme}.png`);
      await page.screenshot({
        path: file,
        fullPage: Boolean(flags["full-page"]),
      });
      written.push(file);
    }
  }
  await context.close();
}
await browser.close();
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
    const m = s.file.match(/^(.*?)-(light|dark)(-\d+)?\.png$/);
    const key = m ? `${m[1]}${m[3] ?? ""}` : s.file;
    const g = groups.get(key) ?? { key, shots: [], mtime: 0 };
    g.shots.push({ ...s, theme: m?.[2] ?? "" });
    g.mtime = Math.max(g.mtime, s.mtime);
    groups.set(key, g);
  }
  const git = (...a) =>
    execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();
  const facts = [
    ["Branch", git("rev-parse", "--abbrev-ref", "HEAD")],
    ["Commit", git("rev-parse", "--short", "HEAD")],
    ["Taken", new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"],
    [
      "Viewport",
      `${width} px wide, 2× scale${flags["full-page"] ? ", full page" : ""}`,
    ],
  ];
  const esc = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const html = `<title>Screenshots ${esc(facts[1][1])}</title>
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
  figure { margin: 0; display: grid; gap: 8px; }
  figcaption { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: var(--accent); }
  .frame { border: 1px solid var(--line); background: var(--panel); border-radius: 6px; overflow: hidden; }
  .frame img { display: block; width: 100%; height: auto; max-width: 100%; }
  @media (max-width: 480px) { dl { grid-template-columns: 1fr; gap: 0 } dt { margin-top: 8px } }
</style>
<main>
  <h1>Dashboard screenshots</h1>
  <dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
${[...groups.values()]
  .sort((a, b) => b.mtime - a.mtime)
  .map(
    (g) => `  <section>
    <h2>${esc(g.key)}</h2>
${g.shots
  .sort((a, b) => a.theme.localeCompare(b.theme) * -1)
  .map(
    (s) => `    <figure>
      <figcaption>${esc(s.theme || s.file)}</figcaption>
      <div class="frame"><img src="${esc(s.file)}" alt="${esc(g.key)} ${esc(s.theme)}" loading="lazy"></div>
    </figure>`,
  )
  .join("\n")}
  </section>`,
  )
  .join("\n")}
</main>
`;
  const index = join(out, "index.html");
  writeFileSync(index, html);
  console.error(`gallery: ${index}`);
}
