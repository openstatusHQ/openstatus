"use client";

import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@openstatus/api";

type AuditLog = RouterOutputs["auditLog"]["list"][number];

type ChangeRow = {
  field: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Fields we never surface in the CHANGES view.
 *
 * `createdAt`/`updatedAt` are churny bookkeeping — already filtered from
 * `changedFields` by `diffTopLevel` in the services package, but they
 * still show up on create/delete snapshots.
 *
 * `id`/`workspaceId` duplicate info already on the row header.
 *
 * This is a display-side belt-and-braces only. Proper secret/PII
 * redaction (webhook URLs with tokens, hashed api keys, etc.) is the
 * server-side redaction PR's job — don't treat this list as a security
 * boundary.
 */
const HIDDEN_FIELDS = new Set([
  "id",
  "workspaceId",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

/**
 * Build a field-level diff from `before`/`after`/`changedFields`.
 *
 * - update: both snapshots present → only rows for keys in `changedFields`.
 * - create: only `after` present → every top-level key as an addition.
 * - delete: only `before` present → every top-level key as a removal.
 *
 * Returns an empty array when there's nothing structured to show (e.g. a
 * metadata-only action emitted without snapshots).
 */
function buildChanges(row: AuditLog): ChangeRow[] {
  const { before, after, changedFields } = row;

  if (before && after) {
    if (!changedFields?.length) return [];
    return changedFields
      .filter((field) => !HIDDEN_FIELDS.has(field))
      .map((field) => ({
        field,
        before: (before as Record<string, unknown>)[field],
        after: (after as Record<string, unknown>)[field],
      }));
  }

  if (after) {
    return Object.keys(after)
      .filter((field) => !HIDDEN_FIELDS.has(field))
      .map((field) => ({
        field,
        after: (after as Record<string, unknown>)[field],
      }));
  }

  if (before) {
    return Object.keys(before)
      .filter((field) => !HIDDEN_FIELDS.has(field))
      .map((field) => ({
        field,
        before: (before as Record<string, unknown>)[field],
      }));
  }

  return [];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value === "" ? "—" : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value) && value.length === 0) return "—";
  return JSON.stringify(value);
}

export function DataTableRowDetails({ row }: { row: AuditLog }) {
  const changes = buildChanges(row);

  return (
    <div className="grid gap-3 bg-muted/30 p-4 text-xs">
      {changes.length ? (
        <div className="grid gap-2">
          <div className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider">
            Changes
          </div>
          <div className="overflow-hidden rounded-md border bg-background">
            {changes.map((change, idx) => (
              <div
                key={change.field}
                className={cn(
                  "grid grid-cols-[160px_1fr]",
                  idx > 0 && "border-t",
                )}
              >
                <div className="border-r bg-muted/40 px-3 py-2 font-mono text-muted-foreground">
                  {change.field}
                </div>
                <div className="grid">
                  {"before" in change ? (
                    <DiffLine kind="removed" value={change.before} />
                  ) : null}
                  {"after" in change ? (
                    <DiffLine kind="added" value={change.after} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiffLine({
  kind,
  value,
}: {
  kind: "added" | "removed";
  value: unknown;
}) {
  const sign = kind === "added" ? "+" : "-";
  return (
    <div className="flex items-start gap-2 px-3 py-2 font-mono">
      <span
        className={cn("select-none text-muted-foreground", {
          "text-success": kind === "added",
          "text-destructive": kind === "removed",
        })}
      >
        {sign}
      </span>
      <span
        className={cn("whitespace-pre-wrap break-all", {
          "text-foreground": kind === "added",
          "text-muted-foreground line-through": kind === "removed",
        })}
      >
        {formatValue(value)}
      </span>
    </div>
  );
}
