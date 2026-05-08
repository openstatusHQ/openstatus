/**
 * API key scopes.
 *
 * `'read'` and `'write'` are the only values a public caller can set when
 * creating a key. `'*'` is internal-only — synthesized by middleware for
 * super-admin and dev fallbacks. The matcher treats it uniformly so there
 * is no hardcoded bypass anywhere else in the stack.
 *
 * The shape is JSON-array forward compatible: when per-resource scopes
 * land (`'monitor.read'`, `'page.write'`), they extend this union without
 * a column migration.
 */
export const apiKeyScopes = ["read", "write", "*"] as const;
export type Scope = (typeof apiKeyScopes)[number];

/**
 * The subset of scopes a caller may set via the create-key API. `'*'` is
 * filtered out at the parse boundary so it can never ride in on the wire.
 */
export const apiKeySettableScopes = ["read", "write"] as const;
export type SettableScope = (typeof apiKeySettableScopes)[number];
