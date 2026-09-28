"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { FormValues } from "@/components/forms/incident/form";
import { FormSheetDeclareIncident } from "@/components/forms/incident/sheet";
import { useTRPC } from "@/lib/trpc/client";

export type DeclareSource = {
  type: "monitor_incident" | "status_report";
  id: number;
};

/** Opens the declare sheet and lands on the new incident once declared. */
export function DeclareIncidentButton({
  children,
  defaultValues,
  source,
  footer,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<FormValues>;
  source?: DeclareSource;
  footer?: React.ReactNode;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const declare = useMutation(
    trpc.incident.declare.mutationOptions({
      onSuccess: (incident) => {
        queryClient.invalidateQueries({
          queryKey: trpc.incident.list.queryKey(),
        });
        if (incident) router.push(`/incidents/${incident.id}`);
      },
    }),
  );

  return (
    <FormSheetDeclareIncident
      defaultValues={defaultValues}
      footer={footer}
      onSubmit={async (values) => {
        await declare.mutateAsync({ ...values, source });
      }}
    >
      {children}
    </FormSheetDeclareIncident>
  );
}
