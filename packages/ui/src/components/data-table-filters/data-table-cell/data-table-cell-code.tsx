export function DataTableCellCode({
  value,
  color,
}: {
  value: string | number;
  color?: string;
}) {
  return (
    <span className="font-mono" style={color ? { color } : undefined}>
      {value}
    </span>
  );
}
