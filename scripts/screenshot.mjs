#!/usr/bin/env node
// Screenshot pages of a local Next.js dev server, in light and dark.
//
//   node scripts/screenshot.mjs --app dashboard /incidents/1 --selector "[data-slot=timeline]"
//   node scripts/screenshot.mjs --app web /pricing --full-page
//   node scripts/screenshot.mjs --app status-page /acme
//
// Flags: --app dashboard|web|status-page (default dashboard), --base <url>,
// --selector <css>, --theme both|light|dark, --out <dir>, --width <px>,
// --full-page, --user <email>, --workspace <slug>, --token <session token>,
// --db <sqld http url>, --login <email> --log <dev server log file>.
//
// The dashboard needs a login. In order: --token, a live row in the `session`
// table (the seed creates seed-session-max and seed-session-thibault; narrow
// with --user), a saved storage state, or --login, which submits the email
// form and follows the `>>> Magic Link:` line the dev server prints to --log.
// Playwright is borrowed from apps/screenshot-service so the version follows
// that package; the browser is the system Chrome, or Playwright's bundled
// Chromium where there is none.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
          order by s.expires desc limit 1`,
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
            where m.user_id = ? order by m.workspace_id limit 1`,
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

// apps/web and the dashboard both default to :3001 on this machine; the
// dashboard's /login is a form, everything else answers 404 there.
const probe = await fetch(base + (app.probe ?? paths[0])).catch(() => null);
if (!probe || probe.status === 404 || probe.status >= 500) {
  console.error(
    `nothing usable at ${base}${app.probe ?? paths[0]} (${probe?.status ?? "unreachable"}); start the ${flags.app ?? "dashboard"} dev server or pass --base`,
  );
  process.exit(1);
}

// System Chrome locally; a remote VM has none, so fall back to Playwright's
// bundled Chromium (`cd apps/screenshot-service && npx playwright install chromium`).
const browser = await chromium
  .launch({ channel: "chrome" })
  .catch(async (e) => {
    console.error(
      `chrome: ${e.message.split("\n")[0]}; trying bundled chromium`,
    );
    return chromium.launch().catch((e2) => {
      console.error(
        `chromium: ${e2.message.split("\n")[0]}\nrun: cd apps/screenshot-service && npx playwright install chromium`,
      );
      process.exit(1);
    });
  });
let auth = null;
if (flags.token) auth = cookies(flags.token, flags.workspace);
else if (wantsAuth && !flags.login)
  auth = await sessionCookies().catch(
    (e) => (console.error(`auth: ${e.message}`), null),
  );
// One login for all themes: the dashboard rate-limits magic-link emails.
if (flags.login) {
  const context = await browser.newContext();
  await magicLinkLogin(context);
  await context.close();
}
const useState = wantsAuth && !auth && existsSync(stateFile);
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
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    // Only the dashboard has a login page, so landing there means auth
    // failed or --base points at the dashboard for another app.
    if (page.url().includes("/login"))
      throw new Error(
        app.auth
          ? `redirected to login for ${path}; auth failed`
          : `${base} serves the dashboard, not ${flags.app}; pass --base`,
      );
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
for (const f of written) console.log(f);
