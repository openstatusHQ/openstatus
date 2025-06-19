"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetNotifier } from "@/components/forms/notifier/sheet";
import { getActions } from "@/data/notifiers.client";
import { useTRPC } from "@/lib/trpc/client";
import { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const updateNotifierMutation = useMutation(
    trpc.notification.updateNotifier.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey(),
        });
      },
    })
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Delete",
          confirmationValue: "delete notifier",
        }}
      />
      <FormSheetNotifier
        provider={props.row.original.provider}
        defaultValues={{
          name: props.row.original.name,
          provider: props.row.original.provider,
          // TBD: parse it?
          data: JSON.parse(props.row.original.data ?? "{}"),
        }}
        onSubmit={async (values) => {
          await updateNotifierMutation.mutateAsync({
            id: props.row.original.id,
            name: values.name,
            data: values.data,
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
