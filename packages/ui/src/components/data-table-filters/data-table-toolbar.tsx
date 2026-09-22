"use client";

import { SidebarLeft } from "@openstatus/icons";
import { useControls } from "@openstatus/ui/components/data-table-filters/controls";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { Button } from "@openstatus/ui/components/ui/button";
import { Kbd, KbdGroup } from "@openstatus/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useHotKey } from "@openstatus/ui/hooks/use-hot-key";
import { formatCompactNumber } from "@openstatus/ui/lib/format";

import { DataTableFilterControlsDrawer } from "./data-table-filter-controls-drawer";
import { DataTableRefreshButton } from "./data-table-refresh-button";
import { DataTableResetButton } from "./data-table-reset-button";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps {
  renderActions?: () => React.ReactNode;
}

export function DataTableToolbar({ renderActions }: DataTableToolbarProps) {
  const { table, isLoading, columnFilters, totalRows, filterRows } =
    useDataTable();
  const { open, setOpen } = useControls();
  useHotKey(() => setOpen((prev) => !prev), "\\", { code: "Backslash" });
  const rows = {
    total: totalRows ?? table.getCoreRowModel().rows.length,
    filtered: filterRows ?? table.getFilteredRowModel().rows.length,
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="-ml-2.5 flex flex-wrap items-center gap-2">
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen((prev) => !prev)}
                className="hidden h-9 w-9 sm:flex"
              >
                <SidebarLeft />
                <span className="sr-only">
                  {open ? "Hide Controls" : "Show Controls"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="flex items-center gap-2 text-nowrap"
            >
              Toggle Controls
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>\</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="block sm:hidden">
          <DataTableFilterControlsDrawer />
        </div>
        <div>
          <p className="text-muted-foreground hidden text-sm sm:block">
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            of{" "}
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.total)}
            </span>{" "}
            row(s) <span className="sr-only sm:not-sr-only">filtered</span>
          </p>
          <p className="text-muted-foreground block text-sm sm:hidden">
            <span className="font-mono font-medium">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            row(s)
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {columnFilters.length ? <DataTableResetButton /> : null}
        {renderActions?.()}
        <DataTableRefreshButton />
        <DataTableViewOptions />
      </div>
    </div>
  );
}
