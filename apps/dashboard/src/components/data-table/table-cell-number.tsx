import { type VariantProps, cva } from "class-variance-authority";

import type { StatusVariant } from "@/components/common/status-dot";
import { cn } from "@/lib/utils";

import { TableCellEmpty } from "./table-cell-empty";

const tableCellNumberVariants = cva("font-mono", {
  variants: {
    variant: {
      default: "text-foreground",
      success: "text-success",
      warning: "text-warning",
      destructive: "text-destructive",
      info: "text-info",
    } satisfies Record<StatusVariant, string>,
  },
  defaultVariants: { variant: "default" },
});

export function TableCellNumber({
  value,
  className,
  unit,
  empty = "—",
  variant,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof tableCellNumberVariants> & {
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
    <div
      className={cn(tableCellNumberVariants({ variant }), className)}
      {...props}
    >
      {_value}
      {unit && <span className="text-muted-foreground p-0.5">{unit}</span>}
    </div>
  );
}
