import type { Scope } from "@openstatus/db/src/schema";

/**
 * Pure scope matcher. Returns true when `held` (the scopes carried by
 * the actor) satisfies `required` (the scope the verb demands).
 *
 * Hierarchy:
 *
 *     '*' ⊇ 'write' ⊇ 'read'
 *
 * Forward-compatible: when per-resource scopes land
 * (`'monitor.write' ⊇ 'monitor.read'`, etc.) extend this matcher in
 * place. The actor-aware wrapper (`require-scope.ts`) is unaffected.
 *
 * Fail-closed: any unrecognized string in `held` matches nothing. A
 * corrupt row, manual SQL edit, or future migration bug results in
 * "no permission," not a permissive default.
 */
export function matchesScope(held: readonly Scope[], required: Scope): boolean {
  if (held.length === 0) return false;

  for (const h of held) {
    if (h === "*") return true;
    if (h === required) return true;
    if (required === "read" && h === "write") return true;
  }
  return false;
}
