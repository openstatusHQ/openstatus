import { cn } from "@/lib/utils";

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
