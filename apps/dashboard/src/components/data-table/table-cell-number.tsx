import { cn } from "@/lib/utils";

export function TableCellNumber({
  value,
  className,
  unit,
  ...props
}: React.ComponentProps<"div"> & { value: unknown; unit?: string }) {
  const _value = Number(value);
  if (isNaN(_value)) {
    return <div className="font-mono text-muted-foreground">N/A</div>;
  }

  return (
    <div className={cn("font-mono text-foreground", className)} {...props}>
      {_value}
      {unit && <span className="text-muted-foreground p-0.5">{unit}</span>}
    </div>
  );
}
