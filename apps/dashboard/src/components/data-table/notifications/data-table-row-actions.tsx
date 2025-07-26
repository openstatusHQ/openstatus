"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetNotifier } from "@/components/forms/notifications/sheet";
import { getActions } from "@/data/notifications.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

type Notifier = RouterOutputs["notification"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Notifier>;
}

export function DataTableRowActions(props: DataTableRowActionsProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const updateNotifierMutation = useMutation(
    trpc.notification.updateNotifier.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey(),
        });
      },
    }),
  );
  const deleteNotifierMutation = useMutation(
    trpc.notification.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey(),
        });
      },
    }),
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Delete",
          confirmationValue: "delete notifier",
          submitAction: async () => {
            await deleteNotifierMutation.mutateAsync({
              id: props.row.original.id,
            });
          },
        }}
      />
      <FormSheetNotifier
        provider={props.row.original.provider}
        defaultValues={{
          name: props.row.original.name,
          provider: props.row.original.provider,
          // TBD: parse it?
          data: JSON.parse(props.row.original.data ?? "{}"),
          monitors: props.row.original.monitors.map((m) => m.id),
        }}
        monitors={monitors ?? []}
        onSubmit={async (values) => {
          await updateNotifierMutation.mutateAsync({
            id: props.row.original.id,
            name: values.name,
            data:
              typeof values.data === "string"
                ? { [values.provider]: values.data }
                : values.data,
            monitors: values.monitors,
          });
        }}
      >
        <button ref={buttonRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetNotifier>
    </>
  );
}
