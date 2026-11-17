"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { useTRPC } from "@/lib/trpc/client";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

/** Controlled edit sheet for a list row; saving refetches every maintenance list. */
export function MaintenanceEditSheet({
  maintenance,
  open,
  onOpenChange,
}: {
  maintenance: Maintenance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: statusPage } = useQuery(
    // only an open sheet needs the component tree
    trpc.page.get.queryOptions(
      { id: maintenance.pageId ?? 0 },
      { enabled: open && maintenance.pageId !== null },
    ),
  );
  const update = useMutation(
    trpc.maintenance.update.mutationOptions({
      // no-input prefix keys: every maintenance list, and the windows derived from them
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.maintenance.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.maintenanceWindow.list.queryKey(),
          }),
        ]),
    }),
  );

  return (
    <FormSheetMaintenance
      open={open}
      onOpenChange={onOpenChange}
      items={toCheckboxTreeItems(
        statusPage?.pageComponents ?? [],
        statusPage?.pageComponentGroups ?? [],
      )}
      components={statusPage?.pageComponents ?? []}
      defaultValues={{
        title: maintenance.title,
        startDate: maintenance.from,
        endDate: maintenance.to,
        pageComponents: maintenance.pageComponents?.map((c) => c.id) ?? [],
      }}
      window={maintenance.window?.derived ? null : maintenance.window}
      onSubmit={async (values) => {
        await update.mutateAsync({
          id: maintenance.id,
          title: values.title,
          startDate: values.startDate,
          endDate: values.endDate,
          pageComponents: values.pageComponents,
        });
      }}
    />
  );
}
