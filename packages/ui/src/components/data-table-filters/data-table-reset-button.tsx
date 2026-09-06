"use client";

import { Close } from "@openstatus/icons";
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

export function DataTableResetButton() {
  const { table } = useDataTable();
  useHotKey(table.resetColumnFilters, "Escape");

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button variant="ghost" onClick={() => table.resetColumnFilters()}>
            <Close className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="flex items-center gap-2 text-nowrap"
        >
          Reset Filters
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>Esc</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
