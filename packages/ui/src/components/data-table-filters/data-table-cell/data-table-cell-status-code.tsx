import { getStatusColor } from "@openstatus/ui/lib/data-table-filters/status-code";

export function DataTableCellStatusCode({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const colors = getStatusColor(value);
  return (
    <span
      className={`font-mono ${color ? "" : colors.text}`}
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  );
}
