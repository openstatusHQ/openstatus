import { cn } from "@/lib/utils";

export function TableCellBoolean({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: unknown }) {
  const _value = Boolean(value);

  return (
    <div
      className={cn(
        "font-mono",
        _value ? "text-foreground" : "text-foreground/70",
        className
      )}
      {...props}
    >
      {String(_value)}
    </div>
  );
}
