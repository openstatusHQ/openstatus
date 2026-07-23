import { cn } from "@/lib/utils";

export function TableCellNumber({
  value,
  className,
  unit,
  ...props
}: React.ComponentProps<"div"> & { value: unknown; unit?: string }) {
  const _value = Number(value);
  if (Number.isNaN(_value)) {
    return <div className="text-muted-foreground font-mono">N/A</div>;
  }

  return (
    <div className={cn("text-foreground font-mono", className)} {...props}>
      {_value}
      {unit && <span className="text-muted-foreground p-0.5">{unit}</span>}
    </div>
  );
}
