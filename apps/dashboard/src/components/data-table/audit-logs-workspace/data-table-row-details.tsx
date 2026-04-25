"use client";

import { CopyRow } from "@/components/common/copy-row";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@openstatus/api";

type AuditLog = RouterOutputs["auditLog"]["list"]["items"][number];

type ChangeRow = {
  field: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Fields we never surface in the CHANGES view.
 *
 * `createdAt`/`updatedAt`/`deletedAt` are churny bookkeeping — already
 * filtered from `changedFields` by `diffTopLevel` in the services
 * package, but they still show up on create/delete snapshots.
 *
 * `workspaceId` is implied by the workspace scope of the audit log
 * itself — noise, not signal.
 *
 * `id` stays visible: with per-entity audit rows, the entity id tells
 * the reader *which* component / group / monitor this row refers to.
 *
 * This is a display-side belt-and-braces only. Proper secret/PII
 * redaction (webhook URLs with tokens, hashed api keys, etc.) is the
 * server-side redaction PR's job — don't treat this list as a security
 * boundary.
 */
const HIDDEN_FIELDS = new Set([
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
    <div className="bg-muted/30 p-4">
      {changes.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="col-span-2 flex flex-col gap-2">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Changes
            </div>
            <div className="overflow-hidden rounded-md border bg-background text-sm">
              {changes.map((change, idx) => (
                <div
                  key={change.field}
                  className={cn(
                    "grid grid-cols-1 md:grid-cols-4",
                    idx > 0 && "border-t",
                  )}
                >
                  <div className="truncate border-r bg-muted/40 px-3 py-2 font-mono text-muted-foreground md:col-span-1">
                    {change.field}
                  </div>
                  <div className="grid truncate md:col-span-3">
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
          <div className="flex flex-col gap-2">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Entry
            </div>
            <dl className="flex flex-col gap-1.5">
              <CopyRow label="Entity Type" value={row.entityType} />
              <CopyRow label="Entity ID" value={row.entityId} />
              <CopyRow label="Actor Type" value={row.actorType} />
              <CopyRow label="Actor ID" value={row.actorId} />
              {row.user?.name ? (
                <CopyRow label="User Name" value={row.user.name} />
              ) : null}
              {row.user?.email ? (
                <CopyRow label="User Email" value={row.user.email} />
              ) : null}
            </dl>
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
    <div
      className="group flex items-start gap-2 px-3 py-2 font-mono has-[+[data-kind=added]]:pb-0"
      data-kind={kind}
    >
      <span className="select-none text-muted-foreground group-data-[kind=added]:text-success group-data-[kind=removed]:text-destructive">
        {sign}
      </span>
      <span className="whitespace-pre-wrap break-all group-data-[kind=added]:text-foreground group-data-[kind=removed]:text-muted-foreground group-data-[kind=removed]:line-through">
        {formatValue(value)}
      </span>
    </div>
  );
}
