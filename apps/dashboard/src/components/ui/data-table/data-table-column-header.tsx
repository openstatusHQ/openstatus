import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.ComponentProps<"button"> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        column.toggleSorting(undefined);
      }}
      className={cn(
        "flex h-7 w-full items-center justify-between gap-2 px-0 py-0 hover:bg-transparent dark:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      <span>{title}</span>
      <span className="flex flex-col">
        <ChevronUp
          className={cn(
            "-mb-0.5 size-3",
            column.getIsSorted() === "asc"
              ? "text-accent-foreground"
              : "text-muted-foreground",
          )}
        />
        <ChevronDown
          className={cn(
            "-mt-0.5 size-3",
            column.getIsSorted() === "desc"
              ? "text-accent-foreground"
              : "text-muted-foreground",
          )}
        />
      </span>
    </Button>
  );
}
