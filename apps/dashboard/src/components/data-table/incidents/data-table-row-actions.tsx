"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useState } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/incidents.client";
import { useTRPC } from "@/lib/trpc/client";

import {
  DialogConfirmIncident,
  type IncidentConfirmType,
} from "./dialog-confirm";

type Incident = RouterOutputs["incident"]["list"][number];

export function DataTableRowActions({ row }: { row: Row<Incident> }) {
  return <IncidentRowActions incident={row.original} />;
}

export function IncidentRowActions({ incident }: { incident: Incident }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteIncidentMutation = useMutation(
    trpc.incident.delete.mutationOptions({
      onSuccess: () =>
        // no-input prefix key — matches every incident.list query (overview, monitor detail)
        queryClient.invalidateQueries({
          queryKey: trpc.incident.list.queryKey(),
        }),
    }),
  );

  const [type, setType] = useState<IncidentConfirmType | null>(null);

  const actions = getActions({
    acknowledge: incident.acknowledgedAt
      ? undefined
      : () => setType("acknowledge"),
    resolve: incident.resolvedAt ? undefined : () => setType("resolve"),
  });

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: incident.title || "incident",
          submitAction: async () => {
            await deleteIncidentMutation.mutateAsync({
              id: incident.id,
            });
          },
        }}
      />
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
