import { cn } from "@/lib/utils";

import { TableCellEmpty } from "./table-cell-empty";

export function TableCellText({
  value,
  empty,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: unknown; empty?: string }) {
  if (typeof value === "string" && value.length > 0) {
    return (
      <div className={cn(className)} {...props}>
        {value}
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div className={cn(className)} {...props}>
        {value}
      </div>
    );
  }
  return (
    <TableCellEmpty className={className} {...props}>
      {empty}
    </TableCellEmpty>
  );
}
