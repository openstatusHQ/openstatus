import type { RequiredScope, Scope } from "@openstatus/db/src/schema";
import { scopeGroup } from "@openstatus/db/src/schema/api-keys/constants";

/**
 * Pure scope matcher: does `held` (the credential's scopes) satisfy
 * `required` (what the verb demands)?
 *
 *   '*'          ⊇ everything, including 'admin'
 *   'any'        ⊆ any non-empty held
 *   'write'      ⊇ 'read', every '<group>:read' and '<group>:write'
 *   'read'       ⊇ every '<group>:read'
 *   '<g>:write'  ⊇ '<g>:read'
 *
 * Fail-closed: unknown strings in `held` match nothing, and no settable
 * scope satisfies 'admin'.
 */
export function matchesScope(
  held: readonly Scope[],
  required: RequiredScope,
): boolean {
  if (held.length === 0) return false;
  if (required === "any") return true;

  for (const h of held) {
    if (h === "*") return true;
    if (required === "admin" || required === "*") continue;
    if (h === required) return true;
    if (h === "write") return true;
    if (h === "read") {
      if (required.endsWith(":read")) return true;
      continue;
    }
    const group = scopeGroup(h);
    if (group && h === `${group}:write` && required === `${group}:read`) {
      return true;
    }
  }
  return false;
}
