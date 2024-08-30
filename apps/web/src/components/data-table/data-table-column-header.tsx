import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@openstatus/ui";

import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => {
          column.toggleSorting(undefined);
        }}
      >
        <span>{title}</span>
        <span className="ml-2 flex flex-col">
          <ChevronUp
            className={cn(
              "-mb-0.5 h-3 w-3",
              column.getIsSorted() === "asc" || !column.getIsSorted()
                ? "text-accent-foreground"
                : "text-muted-foreground/70"
            )}
          />
          <ChevronDown
            className={cn(
              "-mt-0.5 h-3 w-3",
              column.getIsSorted() === "desc" || !column.getIsSorted()
                ? "text-accent-foreground"
                : "text-muted-foreground/70"
            )}
          />
        </span>
      </Button>
    </div>
  );
}
