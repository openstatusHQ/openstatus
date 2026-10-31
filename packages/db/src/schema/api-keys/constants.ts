/**
 * Scopes carried by API keys and OAuth grants.
 *
 * Group scopes (`monitors:write`) are the unit of access. `read` and
 * `write` are legacy umbrellas kept for existing keys, Terraform and the
 * CLI: `write` covers every group, `read` covers every group's read. `'*'`
 * is internal-only, synthesized by middleware
 * for super-admin and dev fallbacks. Stored as a JSON array, so adding a
 * value needs no column migration.
 */
export const scopeGroups = [
  "monitors",
  "pages",
  "incidents",
  "notifications",
  "subscribers",
] as const;
export type ScopeGroup = (typeof scopeGroups)[number];

export type GroupScope = `${ScopeGroup}:read` | `${ScopeGroup}:write`;

export const groupScopes = [
  "monitors:read",
  "monitors:write",
  "pages:read",
  "pages:write",
  "incidents:read",
  "incidents:write",
  "notifications:read",
  "notifications:write",
  "subscribers:read",
  "subscribers:write",
] as const satisfies readonly GroupScope[];

/** Values a caller may set on a key or request in an OAuth `scope` string. */
export const apiKeySettableScopes = ["read", "write", ...groupScopes] as const;
export type SettableScope = (typeof apiKeySettableScopes)[number];

/** Values a stored row may hold. */
export const apiKeyScopes = [...apiKeySettableScopes, "*"] as const;
export type Scope = (typeof apiKeyScopes)[number];

/**
 * Scopes a verb or tool may require but no credential can hold. `admin` is
 * satisfied only by `'*'`, which locks keys and grants out of admin verbs by
 * construction. `any` is satisfied by every authenticated credential.
 */
export const requiredOnlyScopes = ["admin", "any"] as const;
export type RequiredScope = Scope | (typeof requiredOnlyScopes)[number];

export function isGroupScope(scope: string): scope is GroupScope {
  return (groupScopes as readonly string[]).includes(scope);
}

export function scopeGroup(scope: string): ScopeGroup | null {
  if (!isGroupScope(scope)) return null;
  return scope.slice(0, scope.indexOf(":")) as ScopeGroup;
}

export function isReadScope(scope: RequiredScope): boolean {
  return scope === "read" || scope === "any" || scope.endsWith(":read");
}

/**
 * Human-readable presets. `incidents` is what the first consent screen
 * promised for "Read & write"; `setup` is what an agent needs to configure a
 * workspace. Subscribers and admin are in neither.
 */
export const scopePresets = {
  read: ["read"],
  incidents: [
    "incidents:write",
    "monitors:read",
    "pages:read",
    "notifications:read",
  ],
  setup: [
    "monitors:write",
    "pages:write",
    "incidents:write",
    "notifications:read",
  ],
  write: ["write"],
} as const satisfies Record<string, readonly SettableScope[]>;
export type ScopePreset = keyof typeof scopePresets;
