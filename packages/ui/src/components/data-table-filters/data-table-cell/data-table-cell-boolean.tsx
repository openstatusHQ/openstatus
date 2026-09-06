import { Check, Remove } from "@openstatus/icons";

export function DataTableCellBoolean({
  value,
  color,
}: {
  value: boolean;
  color?: string;
}) {
  if (value) {
    return (
      <Check
        className={`ml-auto h-4 w-4 ${color ? "" : "text-foreground"}`}
        style={color ? { color } : undefined}
      />
    );
  }
  return (
    <Remove
      className={`ml-auto h-4 w-4 ${color ? "" : "text-muted-foreground/50"}`}
      style={color ? { color } : undefined}
    />
  );
}
