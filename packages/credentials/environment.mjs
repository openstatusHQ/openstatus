import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { parse } from "smol-toml";

export function loadDotenv() {
  let values;
  try {
    values = parseEnv(readFileSync(".env", "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw new Error("Unable to read the application's .env file.");
  }
  if (values.SECRETSPEC_PROVIDER !== undefined) {
    values = {
      SECRETSPEC_PROVIDER: values.SECRETSPEC_PROVIDER,
      ...(values.SECRETSPEC_PROFILE === undefined
        ? {}
        : { SECRETSPEC_PROFILE: values.SECRETSPEC_PROFILE }),
    };
  }
  for (const [name, value] of Object.entries(values)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function readManifest() {
  return parse(
    readFileSync(new URL("./secretspec.toml", import.meta.url), "utf8"),
  );
}

export function applyEnvironment(fields, { provider, scope, profile }) {
  if (provider === "null" || provider === "null://") {
    const manifest = readManifest();
    const names = scope
      ? manifest.scopes[scope].secrets
      : Object.keys({
          ...manifest.profiles.default,
          ...manifest.profiles[profile],
        });
    for (const name of names) delete process.env[name];
  }
  for (const [name, value] of Object.entries(fields)) {
    if (value != null) process.env[name] = value;
  }
}

// Keep the fallback limited to the shipped manifest's environment values and defaults.
export function resolveEnvironment({ profile, provider, scope }) {
  const manifest = readManifest();
  const selected = manifest.profiles[profile];
  if (!selected || (scope && !manifest.scopes?.[scope])) {
    throw new Error(
      "SecretSpec resolution failed. Check your profile and scope.",
    );
  }
  if (
    manifest.project.extends ||
    selected.defaults ||
    manifest.profiles.default.defaults
  ) {
    throw new Error(
      "This secret specification requires the SecretSpec native addon.",
    );
  }

  const declarations = { ...manifest.profiles.default, ...selected };
  const names = scope
    ? manifest.scopes[scope].secrets
    : Object.keys(declarations);
  const fields = {};
  const missing = [];
  for (const name of names) {
    const declaration = {
      ...manifest.profiles.default[name],
      ...selected[name],
    };
    if (
      Object.keys(declaration).some(
        (field) => !["description", "required", "default"].includes(field),
      )
    ) {
      throw new Error(
        "This secret specification requires the SecretSpec native addon.",
      );
    }
    if (
      declaration.required !== undefined &&
      typeof declaration.required !== "boolean"
    ) {
      throw new Error(
        `Invalid secret declaration for ${name}: required must be a boolean.`,
      );
    }
    const value =
      (provider === "env" || provider === "env://"
        ? process.env[name]
        : undefined) ?? declaration.default;
    if (value !== undefined) fields[name] = value;
    else if (declaration.required !== false) missing.push(name);
  }
  if (missing.length) {
    throw new Error(`Missing required secrets: ${missing.join(", ")}`);
  }
  return fields;
}
