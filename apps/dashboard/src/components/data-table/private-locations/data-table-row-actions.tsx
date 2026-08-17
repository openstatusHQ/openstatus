"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetPrivateLocation } from "@/components/forms/private-location/sheet";
import { getActions } from "@/data/notifications.client";
import { useTRPC } from "@/lib/trpc/client";

type PrivateLocation = RouterOutputs["privateLocation"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<PrivateLocation>;
}

export function DataTableRowActions(props: DataTableRowActionsProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const updatePrivateLocationMutation = useMutation(
    trpc.privateLocation.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.privateLocation.list.queryKey(),
        });
      },
    }),
  );
  const deletePrivateLocationMutation = useMutation(
    trpc.privateLocation.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.privateLocation.list.queryKey(),
        });
      },
    }),
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: props.row.original.name ?? "private location",
          submitAction: async () => {
            await deletePrivateLocationMutation.mutateAsync({
              id: props.row.original.id,
            });
          },
        }}
      />
      <FormSheetPrivateLocation
        defaultValues={{
          name: props.row.original.name,
          token: props.row.original.token.toString(),
          monitors: props.row.original.monitors.map((m) => m.id),
          metadata: Object.entries(props.row.original.metadata ?? {}).map(
            ([key, value]) => ({ key, value }),
          ),
        }}
        monitors={monitors ?? []}
        onSubmit={async (values) => {
          await updatePrivateLocationMutation.mutateAsync({
            id: props.row.original.id,
            name: values.name,
            monitors: values.monitors,
            metadata: Object.fromEntries(
              values.metadata.map((m) => [m.key, m.value]),
            ),
          });
        }}
      >
        <button ref={buttonRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetPrivateLocation>
    </>
  );
}
