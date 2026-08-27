const LEVEL_COLORS: Record<string, string> = {
  error: "bg-red-500",
  warn: "bg-yellow-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
  debug: "bg-gray-400",
  success: "bg-green-500",
};

export function DataTableCellLevelIndicator({
  value,
  color: colorOverride,
}: {
  value: string;
  color?: string;
}) {
  const builtinColor = LEVEL_COLORS[value.toLowerCase()] ?? "bg-gray-300";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={colorOverride ? { color: colorOverride } : undefined}
    >
      <span
        className={`inline-block size-3.5 shrink-0 rounded-sm ${colorOverride ? "" : builtinColor}`}
        style={colorOverride ? { backgroundColor: colorOverride } : undefined}
      />
      <span>{value}</span>
    </span>
  );
}
