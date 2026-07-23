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
import { useState } from "react";

import { FormSheetMaintenanceCreate } from "@/components/forms/maintenance/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";

export function CreateEventButtonGroup() {
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

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
            <DropdownMenuItem onSelect={() => setMaintenanceOpen(true)}>
              <Plus className="text-muted-foreground" />
              Create Maintenance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <FormSheetMaintenanceCreate
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
      />
    </div>
  );
}
