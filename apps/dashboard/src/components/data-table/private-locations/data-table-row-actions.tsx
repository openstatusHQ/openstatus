"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { Row } from "@tanstack/react-table";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
        void queryClient.invalidateQueries({
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
        }}
        monitors={monitors ?? []}
        onSubmit={async (values) => {
          await updatePrivateLocationMutation.mutateAsync({
            id: props.row.original.id,
            name: values.name,
            monitors: values.monitors,
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
