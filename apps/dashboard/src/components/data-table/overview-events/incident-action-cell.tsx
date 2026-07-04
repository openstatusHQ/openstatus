"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import { DialogConfirmIncident } from "@/components/data-table/incidents/dialog-confirm";

type Incident = RouterOutputs["incident"]["list"][number];

export function IncidentActionCell({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false);

  if (incident.resolvedAt) return null;
  const type = incident.acknowledgedAt ? "resolve" : "acknowledge";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {type === "acknowledge" ? "Acknowledge" : "Resolve"}
      </Button>
      <DialogConfirmIncident
        incident={incident}
        type={type}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
