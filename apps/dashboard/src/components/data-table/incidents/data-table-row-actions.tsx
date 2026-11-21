"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useState } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/incidents.client";

import {
  DialogConfirmIncident,
  type IncidentConfirmType,
} from "./dialog-confirm";
import { DialogExcuseIncident } from "./dialog-excuse";

type Incident = RouterOutputs["monitorIncident"]["list"][number];

export function IncidentRowActions({ incident }: { incident: Incident }) {
  const [type, setType] = useState<IncidentConfirmType | null>(null);
  const [excuseOpen, setExcuseOpen] = useState(false);

  const actions = getActions({
    acknowledge: incident.acknowledgedAt
      ? undefined
      : () => setType("acknowledge"),
    resolve: incident.resolvedAt ? undefined : () => setType("resolve"),
    // only a resolved outage can be excused
    excuse: incident.resolvedAt ? () => setExcuseOpen(true) : undefined,
    unexcuse: () => setType("unexcuse"),
  }).filter(
    // excuse and unexcuse swap places; the other is noise, not a disabled option
    (action) => action.id !== (incident.excusedAt ? "excuse" : "unexcuse"),
  );

  return (
    <>
      <QuickActions actions={actions} />
      <DialogConfirmIncident
        incident={incident}
        type={type}
        open={type !== null}
        onOpenChange={(open) => {
          if (!open) setType(null);
        }}
      />
      <DialogExcuseIncident
        incident={incident}
        open={excuseOpen}
        onOpenChange={setExcuseOpen}
      />
    </>
  );
}
