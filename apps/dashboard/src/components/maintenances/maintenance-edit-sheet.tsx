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
      // no-input prefix key — matches every maintenance.list query (overview, page detail)
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey(),
        }),
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
      defaultValues={{
        title: maintenance.title,
        startDate: maintenance.from,
        endDate: maintenance.to,
        pageComponents: maintenance.pageComponents?.map((c) => c.id) ?? [],
      }}
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
