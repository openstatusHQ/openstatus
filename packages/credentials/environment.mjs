import { readFileSync } from "node:fs";

import { parse } from "smol-toml";

// Keep the fallback limited to the shipped manifest's environment values and defaults.
export function resolveEnvironment({ profile, provider, scope }) {
  const manifest = parse(
    readFileSync(new URL("./secretspec.toml", import.meta.url), "utf8"),
  );
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
      ) ||
      (declaration.required !== undefined &&
        typeof declaration.required !== "boolean")
    ) {
      throw new Error(
        "This secret specification requires the SecretSpec native addon.",
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
