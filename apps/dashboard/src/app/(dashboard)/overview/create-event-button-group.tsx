"use client";

import { ChevronDown } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { ButtonGroup } from "@openstatus/ui/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { useState } from "react";

import { FormSheetMaintenanceCreate } from "@/components/forms/maintenance/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";
import { DeclareIncidentButton } from "@/components/incidents/declare-incident-button";
import { useFeature } from "@/hooks/use-feature";

export function CreateEventButtonGroup() {
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const incidentsEnabled = useFeature("incident-management");

  return (
    <div>
      <ButtonGroup>
        <FormSheetStatusReportCreate>
          <Button data-section="action" variant="outline" size="sm">
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
              Create Maintenance
            </DropdownMenuItem>
            {incidentsEnabled ? (
              <DropdownMenuItem onSelect={() => setIncidentOpen(true)}>
                Declare Incident
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <FormSheetMaintenanceCreate
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
      />
      {/* Mounted on demand: the sheet fetches integrations as soon as it renders. */}
      {incidentsEnabled && incidentOpen ? (
        <DeclareIncidentButton open onOpenChange={setIncidentOpen} />
      ) : null}
    </div>
  );
}
