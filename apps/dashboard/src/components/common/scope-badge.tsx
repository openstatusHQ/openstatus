import { Badge } from "@openstatus/ui/components/ui/badge";

import { TableCellBadge } from "@/components/data-table/table-cell-badge";
import { scopeChips, scopeLabel } from "@/components/forms/api-scopes/label";

export function ScopeBadge({ scopes }: { scopes: readonly string[] }) {
  const label = scopeLabel(scopes);
  if (label !== "Custom") return <Badge variant="secondary">{label}</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {scopeChips(scopes).map((chip) => (
        <TableCellBadge key={chip} value={chip} className="max-w-none" />
      ))}
    </div>
  );
}
