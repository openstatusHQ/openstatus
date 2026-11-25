export function DataTableCellNumber({
  value,
  unit,
  color,
}: {
  value: number;
  unit?: string;
  color?: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return (
    <span className="font-mono" style={color ? { color } : undefined}>
      {formatted}
      {unit && <span className="text-muted-foreground">{unit}</span>}
    </span>
  );
}
