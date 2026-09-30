"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateIncident } from "./use-invalidate-incident";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

/** Whether `IncidentActions` renders anything; lets the page skip the row. */
export function hasIncidentActions(incident: Incident): boolean {
  return (
    (incident.status === "resolved" && incident.closedAt === null) ||
    incident.deletable
  );
}

export function IncidentActions({ incident }: { incident: Incident }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateIncident(incident.id);
  const { data: postmortem } = useQuery(
    trpc.incident.getPostmortem.queryOptions({ id: incident.id }),
  );
  const approved = postmortem?.status === "approved";

  const close = useMutation(
    trpc.incident.close.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to close",
        );
      },
    }),
  );
  const remove = useMutation(
    trpc.incident.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.incident.list.queryKey(),
        });
        router.push("/incidents");
      },
    }),
  );

  const closable = incident.status === "resolved" && incident.closedAt === null;
  if (!closable && !incident.deletable) return null;

  return (
    <>
      {closable ? (
        <Button
          size="sm"
          variant="outline"
          disabled={close.isPending}
          onClick={() =>
            close.mutate({
              id: incident.id,
              skipPostmortem: approved ? undefined : true,
            })
          }
        >
          {approved ? "Close incident" : "Close (skip postmortem)"}
        </Button>
      ) : null}
      {incident.deletable ? (
        <QuickActions
          deleteAction={{
            confirmationValue: incident.title,
            submitAction: async () => {
              await remove.mutateAsync({ id: incident.id });
            },
          }}
        />
      ) : null}
    </>
  );
}
