"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import {
  DialogConfirmIncident,
  type IncidentConfirmType,
} from "@/components/data-table/incidents/dialog-confirm";

type Incident = RouterOutputs["incident"]["list"][number];

export function IncidentActionCell({ incident }: { incident: Incident }) {
  // capture the action at click time so a background refetch can't flip it mid-dialog
  const [type, setType] = useState<IncidentConfirmType | null>(null);

  if (incident.resolvedAt) return null;
  const nextAction = incident.acknowledgedAt ? "resolve" : "acknowledge";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        onClick={(e) => {
          e.stopPropagation();
          setType(nextAction);
        }}
      >
        {nextAction === "acknowledge" ? "Acknowledge" : "Resolve"}
      </Button>
      <DialogConfirmIncident
        incident={incident}
        type={type}
        open={type !== null}
        onOpenChange={(open) => {
          if (!open) setType(null);
        }}
      />
    </>
  );
}
