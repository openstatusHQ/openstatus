"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { ButtonGroup } from "@openstatus/ui/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { ChevronDown, Plus } from "lucide-react";
import { useRef } from "react";

import { FormSheetMaintenanceCreate } from "@/components/forms/maintenance/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";

export function CreateEventButtonGroup() {
  // the maintenance sheet lives outside the dropdown — a trigger inside
  // DropdownMenuContent unmounts (and closes the sheet) when the menu closes
  const maintenanceButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <ButtonGroup>
        <FormSheetStatusReportCreate>
          <Button data-section="action" variant="outline" size="sm">
            <Plus />
            Create Status Report
          </Button>
        </FormSheetStatusReportCreate>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="More create options"
              className="pl-2!"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => maintenanceButtonRef.current?.click()}
            >
              <Plus className="text-muted-foreground" />
              Create Maintenance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <FormSheetMaintenanceCreate>
        <button ref={maintenanceButtonRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetMaintenanceCreate>
    </div>
  );
}
