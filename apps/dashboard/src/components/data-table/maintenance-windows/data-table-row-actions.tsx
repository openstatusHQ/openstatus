"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getMaintenanceWindowActions } from "@/data/maintenance-windows.client";
import { getMaintenanceStatus } from "@/data/overview-events.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

type MaintenanceWindow = RouterOutputs["maintenanceWindow"]["list"][number];

export function MaintenanceWindowRowActions({
  window,
  onEdit,
}: {
  window: MaintenanceWindow;
  onEdit: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.maintenanceWindow.list.queryKey(),
    });
  const endMutation = useMutation(
    trpc.maintenanceWindow.end.mutationOptions({ onSuccess: invalidate }),
  );
  const deleteMutation = useMutation(
    trpc.maintenanceWindow.delete.mutationOptions({ onSuccess: invalidate }),
  );
  const running = getMaintenanceStatus(window) === "in-progress";

  return (
    <QuickActions
      actions={getMaintenanceWindowActions({
        edit: onEdit,
        end: running
          ? async () => {
              const promise = endMutation.mutateAsync({ id: window.id });
              toast.promise(promise, {
                loading: "Ending...",
                success: "Maintenance window ended",
                error: (error) => errorMessage(error, "Failed to end"),
              });
              await promise;
            }
          : undefined,
      })}
      deleteAction={{
        confirmationValue: window.title,
        submitAction: async () => {
          await deleteMutation.mutateAsync({ id: window.id });
        },
      }}
    />
  );
}
