import {
  fieldRefKind,
  toEntityId,
  toEntityIds,
} from "@/data/entity-refs.client";
import {
  type ComponentImpact,
  impactDisplay,
  isComponentImpactList,
} from "@/data/status-report-updates.client";
import { cn } from "@/lib/utils";

import { EntityRef, EntityRefList } from "./entity-ref/entity-ref";
import { StatusBadge } from "./status-badge";

/**
 * Field-level diff row used by the audit-log "CHANGES" view and the
 * chat tool draft/result cards.
 *
 * - Provide both `before` and `after` for an update (renders both lines,
 *   strikethrough on the removed value).
 * - Provide only `after` for a create (renders a single `+ value` line).
 * - Provide only `before` for a delete (renders a single `- value` line).
 *
 * Use `"before" in row` / `"after" in row` to distinguish "absent" from
 * "explicitly null" — null/undefined render as `—`.
 */
export type ChangeRow = {
  field: string;
  before?: unknown;
  after?: unknown;
};

export function ChangesTable({ changes }: { changes: ChangeRow[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="bg-background overflow-hidden rounded-md border text-sm">
      {changes.map((change, idx) => (
        <div
          key={change.field}
          className={cn(
            "grid grid-cols-1 md:grid-cols-4",
            idx > 0 && "border-t",
          )}
        >
          <div className="bg-muted/40 text-muted-foreground truncate border-r px-3 py-2 font-mono md:col-span-1">
            {change.field}
          </div>
          <div className="grid min-w-0 md:col-span-3">
            {"before" in change ? (
              <DiffLine
                kind="removed"
                field={change.field}
                value={change.before}
              />
            ) : null}
            {"after" in change ? (
              <DiffLine
                kind="added"
                field={change.field}
                value={change.after}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffLine({
  kind,
  field,
  value,
}: {
  kind: "added" | "removed";
  field: string;
  value: unknown;
}) {
  const sign = kind === "added" ? "+" : "-";
  return (
    <div
      className="group flex items-start gap-2 px-3 py-2 font-mono has-[+[data-kind=added]]:pb-0"
      data-kind={kind}
    >
      <span className="text-muted-foreground group-data-[kind=added]:text-success group-data-[kind=removed]:text-destructive select-none">
        {sign}
      </span>
      {/* Refs and badges are inline boxes; the removed strikethrough has to be set on them. */}
      <span className="group-data-[kind=added]:text-foreground group-data-[kind=removed]:text-muted-foreground min-w-0 break-all whitespace-pre-wrap group-data-[kind=removed]:line-through group-data-[kind=removed]:[&_[data-slot=badge]]:line-through group-data-[kind=removed]:[&_[data-slot=entity-ref]]:[text-decoration-line:underline_line-through]">
        <DiffValue field={field} value={value} />
      </span>
    </div>
  );
}

function DiffValue({ field, value }: { field: string; value: unknown }) {
  const kind = fieldRefKind(field);
  if (kind === "componentImpacts") {
    if (isComponentImpactList(value) && value.length > 0) {
      return <ImpactList impacts={value} />;
    }
  } else if (kind) {
    // Strings stay text: a diff value of "4" is not a reference.
    const id = typeof value === "number" ? toEntityId(value) : undefined;
    if (id) return <EntityRef kind={kind} id={id} />;
    const ids = toEntityIds(value);
    if (ids) return <EntityRefList kind={kind} refs={ids} />;
  }
  return formatValue(value);
}

function ImpactList({ impacts }: { impacts: ComponentImpact[] }) {
  return (
    <span className="flex flex-col gap-1">
      {impacts.map(({ pageComponentId, impact }) => {
        const display = impactDisplay(impact);
        return (
          <span key={pageComponentId} className="flex items-center gap-2">
            <EntityRef kind="pageComponent" id={pageComponentId} />
            <span className="text-muted-foreground">→</span>
            <StatusBadge plain variant={display.variant} className="font-mono">
              {display.label}
            </StatusBadge>
          </span>
        );
      })}
    </span>
  );
}

const HIDDEN_FIELDS = new Set([
  "workspaceId",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

/** Update: rows from `changedFields`. Create: keys of `after`. Delete: keys of `before`. */
export function buildAuditLogChangeRows(input: {
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
  changedFields: string[] | null | undefined;
}): ChangeRow[] {
  const { before, after, changedFields } = input;

  if (before && after) {
    if (!changedFields?.length) return [];
    return changedFields
      .filter((field) => !HIDDEN_FIELDS.has(field))
      .map((field) => ({
        field,
        before: before[field],
        after: after[field],
      }));
  }

  if (after) {
    return Object.keys(after)
      .filter((field) => !HIDDEN_FIELDS.has(field))
      .map((field) => ({ field, after: after[field] }));
  }

  if (before) {
    return Object.keys(before)
      .filter((field) => !HIDDEN_FIELDS.has(field))
      .map((field) => ({ field, before: before[field] }));
  }

  return [];
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value === "" ? "—" : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value) && value.length === 0) return "—";
  return JSON.stringify(value);
}
