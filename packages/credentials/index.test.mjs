import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "smol-toml";

const moduleUrl = new URL("./index.mjs", import.meta.url).href;
let nativeAvailable = false;
try {
  createRequire(import.meta.url)("secretspec");
  nativeAvailable = true;
} catch {}
const rootManifest = fileURLToPath(
  new URL("../../secretspec.toml", import.meta.url),
);
const state = mkdtempSync(join(tmpdir(), "openstatus-credentials-"));
const env = {
  ...process.env,
  NODE_ENV: "development",
  SECRETSPEC_PROVIDER: "env://",
  XDG_CONFIG_HOME: state,
  XDG_STATE_HOME: state,
  XDG_CACHE_HOME: state,
};
const manifest = parse(
  readFileSync(new URL("./secretspec.toml", import.meta.url), "utf8"),
);
for (const name of Object.keys(manifest.profiles.default)) delete env[name];
delete env.SECRETSPEC_PROFILE;
after(() => rmSync(state, { recursive: true, force: true }));

function run(code, extraEnv = {}) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      cwd: state,
      env: { ...env, ...extraEnv },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.ifError(result.error);
  return result;
}

const initialize = `import { loadCredentials } from ${JSON.stringify(moduleUrl)}; loadCredentials();`;

test("development initializes credentials without .env or a launcher", () => {
  const result = run(
    `${initialize} console.log(process.env.DATABASE_URL, process.env.AUTH_SECRET)`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    "http://127.0.0.1:8080 openstatus-local-development-only\n",
  );
});

test("existing environment credentials take precedence over local defaults", () => {
  const result = run(`${initialize} console.log(process.env.DATABASE_URL)`, {
    DATABASE_URL: "http://localhost:9876",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "http://localhost:9876\n");
});

test("production fails before application imports when required credentials are missing", () => {
  const application = join(state, "application.mjs");
  writeFileSync(application, "console.log('application initialized')");
  const result = run(
    `${initialize} await import(${JSON.stringify(application)});`,
    { NODE_ENV: "production" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Missing required secrets:/);
  assert.match(result.stderr, /DATABASE_URL/);
  assert.match(result.stderr, /AUTH_SECRET/);
});

test("production uses provided credentials without development defaults", () => {
  const result = run(
    `${initialize} console.log(process.env.RESEND_API_KEY === undefined)`,
    {
      NODE_ENV: "production",
      DATABASE_URL: "http://localhost:9876",
      AUTH_SECRET: "private-test-value",
      RESEND_API_KEY: undefined,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "true\n");
  assert.doesNotMatch(result.stdout + result.stderr, /private-test-value/);
});

test("database tooling can initialize without unrelated auth credentials", () => {
  const result = run(
    `import { loadCredentials } from ${JSON.stringify(moduleUrl)}; loadCredentials({ scope: 'database' }); console.log(process.env.DATABASE_URL)`,
    { NODE_ENV: "production", DATABASE_URL: "http://localhost:9876" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "http://localhost:9876\n");
});

test("repeat startup hooks do not resolve secrets a second time", () => {
  const result = run(
    `${initialize} delete process.env.DATABASE_URL; loadCredentials(); console.log(process.env.DATABASE_URL === undefined)`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "true\n");
});

test("provider and profile selections are honored and errors do not expose values", () => {
  const result = run(initialize, {
    SECRETSPEC_PROFILE: "missing",
    AUTH_SECRET: "private-test-value",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SecretSpec resolution failed/);
  assert.doesNotMatch(result.stderr, /private-test-value/);
  const nullProvider = run(
    `${initialize} console.log(process.env.DATABASE_URL)`,
    { SECRETSPEC_PROVIDER: "null://", DATABASE_URL: "http://localhost:9876" },
  );
  assert.equal(nullProvider.status, 0, nullProvider.stderr);
  assert.equal(nullProvider.stdout, "http://127.0.0.1:8080\n");
});

test(
  "the root CLI manifest inherits the application's declarations",
  { skip: !nativeAvailable },
  () => {
    const result = run(
      `import { SecretSpec } from ${JSON.stringify(new URL("./node_modules/secretspec/index.js", import.meta.url).href)}; const result = SecretSpec.builder().withPath(${JSON.stringify(rootManifest)}).withProvider('null://').withProfile('development').withReason('Verify manifest inheritance').load(); console.log(result.secrets.DATABASE_URL.get()); result.dispose();`,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "http://127.0.0.1:8080\n");
  },
);

const intelMac = `Object.defineProperty(process, 'platform', { value: 'darwin' }); Object.defineProperty(process, 'arch', { value: 'x64' });`;
const dynamicInitialize = `const { loadCredentials } = await import(${JSON.stringify(moduleUrl)}); loadCredentials();`;
const snapshot = `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(manifest.profiles.default))}.map(name => [name, process.env[name]]))))`;

for (const [name, variables] of [
  ["development defaults", {}],
  [
    "environment overrides and empty values",
    {
      DATABASE_URL: "http://localhost:9876",
      RESEND_API_KEY: "",
      AUTH_SECRET: "test-session-secret",
    },
  ],
  [
    "production credentials",
    {
      NODE_ENV: "production",
      DATABASE_URL: "http://localhost:9876",
      AUTH_SECRET: "test-session-secret",
    },
  ],
  [
    "local-only defaults",
    { SECRETSPEC_PROVIDER: "null://", DATABASE_URL: "http://localhost:9876" },
  ],
]) {
  test(
    `Intel Mac fallback matches SDK resolution for ${name}`,
    { skip: !nativeAvailable },
    () => {
      const native = run(`${dynamicInitialize} ${snapshot}`, variables);
      const portable = run(
        `${intelMac} ${dynamicInitialize} ${snapshot}`,
        variables,
      );
      assert.equal(native.status, 0, native.stderr);
      assert.equal(portable.status, 0, portable.stderr);
      assert.deepEqual(JSON.parse(portable.stdout), JSON.parse(native.stdout));
    },
  );
}

test("Intel Mac fallback validates required production secrets before changing the environment", () => {
  const result = run(
    `${intelMac} const { loadCredentials } = await import(${JSON.stringify(moduleUrl)}); try { loadCredentials(); } catch (error) { console.log(process.env.AUTH_SECRET === undefined); throw error; }`,
    { NODE_ENV: "production", DATABASE_URL: "http://localhost:9876" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required secrets: AUTH_SECRET/);
  assert.equal(result.stdout, "true\n");
});

test("Intel Mac database tooling resolves only database credentials", () => {
  const result = run(
    `${intelMac} const { loadCredentials } = await import(${JSON.stringify(moduleUrl)}); loadCredentials({ scope: 'database' }); console.log(process.env.DATABASE_URL)`,
    { NODE_ENV: "production", DATABASE_URL: "http://localhost:9876" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "http://localhost:9876\n");
});

test("Intel Mac remote providers fail explicitly instead of silently using environment credentials", () => {
  const result = run(`${intelMac} ${dynamicInitialize}`, {
    SECRETSPEC_PROVIDER: "keyring://",
    AUTH_SECRET: "private-test-value",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /native addon is unavailable on darwin\/x64/);
  assert.doesNotMatch(result.stderr, /private-test-value/);
});
