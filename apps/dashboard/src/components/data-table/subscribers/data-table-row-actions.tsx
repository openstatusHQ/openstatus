"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetSubscriber } from "@/components/forms/subscriber/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { isTRPCClientError } from "@trpc/client";
import { Pencil, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Subscriber>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const { refetch } = useQuery(
    trpc.pageSubscriber.list.queryOptions({
      pageId: row.original.pageId,
    }),
  );
  const [editOpen, setEditOpen] = useState(false);

  const { data: components } = useQuery({
    ...trpc.pageComponent.list.queryOptions({ pageId: row.original.pageId }),
    enabled: editOpen,
  });
  const { data: statusPage } = useQuery({
    ...trpc.page.get.queryOptions({ id: row.original.pageId }),
    enabled: editOpen,
  });

  const deleteAction = useMutation(
    trpc.pageSubscriber.delete.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );
  const updateAction = useMutation(
    trpc.pageSubscriber.updateChannel.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );
  const testAction = useMutation(
    trpc.pageSubscriber.sendTestWebhook.mutationOptions(),
  );

  const sub = row.original;
  const isVendorAdded = sub.source === "vendor";
  const isWebhook = sub.channelType === "webhook";
  const isActive = !sub.unsubscribedAt;

  const items = toCheckboxTreeItems(
    components ?? [],
    statusPage?.pageComponentGroups ?? [],
  );

  const editDefaults = isVendorAdded
    ? {
        channelType: sub.channelType,
        name: sub.name ?? "",
        email: sub.email ?? "",
        webhookUrl: sub.webhookUrl ?? "",
        headers: parseHeaders(sub.channelConfig),
        componentIds: sub.components.map((c) => c.id),
      }
    : undefined;

  const actions = [
    ...(isVendorAdded
      ? [
          {
            id: "edit",
            label: "Edit",
            icon: Pencil,
            variant: "default" as const,
            onClick: () => setEditOpen(true),
          },
        ]
      : []),
    ...(isVendorAdded && isWebhook && isActive
      ? [
          {
            id: "test",
            label: "Send test",
            icon: Send,
            variant: "default" as const,
            onClick: async () => {
              const promise = testAction.mutateAsync({
                subscriberId: sub.id,
                pageId: sub.pageId,
              });
              toast.promise(promise, {
                loading: "Sending test…",
                success: "Test webhook sent",
                error: (error) => {
                  if (isTRPCClientError(error)) return error.message;
                  return "Failed to send test";
                },
              });
              try {
                await promise;
              } catch (error) {
                console.error(error);
              }
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue:
            sub.name ?? sub.email ?? sub.webhookUrl ?? "subscriber",
          submitAction: async () => {
            await deleteAction.mutateAsync({
              id: sub.id,
              pageId: sub.pageId,
            });
          },
        }}
      />
      {isVendorAdded && editDefaults ? (
        <FormSheetSubscriber
          items={items}
          defaultValues={editDefaults}
          editMode
          title="Edit subscriber"
          description="Update channel config, label, or component scope."
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={async (values) => {
            if (values.channelType === "webhook") {
              await updateAction.mutateAsync({
                subscriberId: sub.id,
                pageId: sub.pageId,
                name: values.name || null,
                webhookUrl: values.webhookUrl,
                headers: values.headers,
                componentIds: values.componentIds,
              });
            } else {
              await updateAction.mutateAsync({
                subscriberId: sub.id,
                pageId: sub.pageId,
                name: values.name || null,
                componentIds: values.componentIds,
              });
            }
          }}
        />
      ) : null}
    </>
  );
}

function parseHeaders(
  channelConfig: string | null,
): { key: string; value: string }[] {
  if (!channelConfig) return [];
  try {
    const parsed = JSON.parse(channelConfig) as {
      headers?: { key: string; value: string }[];
    };
    return parsed.headers ?? [];
  } catch {
    return [];
  }
}
