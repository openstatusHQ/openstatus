import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  applyEnvironment,
  loadDotenv,
  resolveEnvironment,
} from "./environment.mjs";

const require = createRequire(import.meta.url);
const loaded = new Set();
const dotenvLoaded = new Set();
const resolutions = [];

process.once("exit", () => {
  for (const resolved of resolutions) resolved.dispose();
});

export function loadCredentials({ scope } = {}) {
  const configuredProvider = process.env.SECRETSPEC_PROVIDER;
  if (configuredProvider === undefined && !dotenvLoaded.has(process.cwd())) {
    loadDotenv();
    dotenvLoaded.add(process.cwd());
  }
  const profile =
    process.env.SECRETSPEC_PROFILE ??
    (process.env.NODE_ENV === "production" ? "default" : "development");
  const provider = process.env.SECRETSPEC_PROVIDER ?? "env://";
  const key = JSON.stringify([profile, provider, scope, process.cwd()]);
  if (loaded.has(key)) return;

  let sdk;
  try {
    sdk = require("secretspec");
  } catch {
    if (!["env", "env://", "null", "null://"].includes(provider)) {
      throw new Error(
        `SecretSpec's native addon is unavailable on ${process.platform}/${process.arch}. Use env:// or install a supported addon for external secret providers.`,
      );
    }
    applyEnvironment(resolveEnvironment({ profile, provider, scope }), {
      provider,
      scope,
      profile,
    });
    loaded.add(key);
    return;
  }

  const { MissingRequiredError, SecretSpec } = sdk;
  const builder = SecretSpec.builder()
    .withPath(fileURLToPath(new URL("./secretspec.toml", import.meta.url)))
    .withProfile(profile)
    .withProvider(provider)
    .withReason("Initialize OpenStatus application credentials");
  if (scope) builder.withScope(scope);

  let resolved;
  try {
    resolved = builder.load();
  } catch (error) {
    throw new Error(
      error instanceof MissingRequiredError
        ? `Missing required secrets: ${error.missing.join(", ")}`
        : "SecretSpec resolution failed. Check your provider configuration and authentication.",
    );
  }
  applyEnvironment(resolved.fields(), { provider, scope, profile });
  resolutions.push(resolved);
  loaded.add(key);
}
