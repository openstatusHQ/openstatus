import { cn } from "@/lib/utils";

import { TableCellEmpty } from "./table-cell-empty";

export function TableCellNumber({
  value,
  className,
  unit,
  empty = "No data",
  ...props
}: React.ComponentProps<"div"> & {
  value: unknown;
  unit?: string;
  empty?: string;
}) {
  const _value = Number(value);
  if (Number.isNaN(_value)) {
    return (
      <TableCellEmpty className={cn("font-mono", className)} {...props}>
        {empty}
      </TableCellEmpty>
    );
  }

  return (
    <div className={cn("text-foreground font-mono", className)} {...props}>
      {_value}
      {unit && <span className="text-muted-foreground p-0.5">{unit}</span>}
    </div>
  );
}
