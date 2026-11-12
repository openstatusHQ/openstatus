"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateIncident } from "./use-invalidate-incident";

export function IncidentAcknowledgeButton({
  incidentId,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> & {
  incidentId: number;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateIncident(incidentId);
  const acknowledge = useMutation(
    trpc.incident.acknowledge.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success("Incident acknowledged");
      },
      onError: (error) =>
        toast.error(errorMessage(error, "Failed to acknowledge")),
    }),
  );
  return (
    <Button
      size="sm"
      disabled={acknowledge.isPending}
      onClick={() => acknowledge.mutate({ id: incidentId })}
      {...props}
    >
      Acknowledge
    </Button>
  );
}
