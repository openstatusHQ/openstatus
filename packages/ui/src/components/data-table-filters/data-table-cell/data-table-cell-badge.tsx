export function DataTableCellBadge({
  value,
  color,
}: {
  value: string | number;
  color?: string;
}) {
  return (
    <span
      className="rounded-sm border px-1.5 py-0.5 font-mono text-xs"
      style={
        color
          ? {
              color,
              backgroundColor: `${color}1a`,
              borderColor: `${color}33`,
            }
          : undefined
      }
    >
      {value}
    </span>
  );
}
