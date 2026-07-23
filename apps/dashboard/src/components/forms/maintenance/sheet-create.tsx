"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetTrigger,
  FormSheetWithDirtyProtection,
} from "@/components/forms/form-sheet";
import { FormMaintenance } from "@/components/forms/maintenance/form";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Create-maintenance sheet with a status page selector — for surfaces that
 * are not scoped to a single page (e.g. /overview). `children` is the trigger.
 */
export function FormSheetMaintenanceCreate({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: pages } = useQuery(trpc.page.list.queryOptions());

  const pageId =
    pages?.length === 1 ? pages[0].id : (selectedPageId ?? undefined);

  const { data: page } = useQuery(
    trpc.page.get.queryOptions(
      { id: pageId ?? 0 },
      { enabled: pageId !== undefined },
    ),
  );

  const sendMaintenanceUpdateMutation = useMutation(
    trpc.subscriberNotification.maintenance.mutationOptions(),
  );
  const createMaintenanceMutation = useMutation(
    trpc.maintenance.new.mutationOptions({
      onSuccess: (maintenance) => {
        if (maintenance.notifySubscribers) {
          sendMaintenanceUpdateMutation.mutate({ id: maintenance.id });
        }
        // no-input prefix key — matches every maintenance.list query
        queryClient.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey(),
        });
      },
    }),
  );

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      {children ? (
        <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      ) : null}
      <FormSheetContent className="sm:max-w-lg">
        <FormSheetHeader>
          <FormSheetTitle>Maintenance</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the maintenance.
          </FormSheetDescription>
        </FormSheetHeader>
        {pages && pages.length > 1 ? (
          <>
            <div className="grid gap-1.5 px-4 py-4">
              <Label htmlFor="maintenance-page-select">Status Page</Label>
              <Select
                value={pageId !== undefined ? String(pageId) : undefined}
                onValueChange={(value) => setSelectedPageId(Number(value))}
              >
                <SelectTrigger id="maintenance-page-select" size="sm">
                  <SelectValue placeholder="Select a status page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
          </>
        ) : null}
        {pageId !== undefined ? (
          <FormCardGroup className="overflow-y-auto">
            <FormCard className="overflow-auto rounded-none border-none">
              <FormMaintenance
                key={pageId}
                id="maintenance-form"
                className="my-4"
                items={toCheckboxTreeItems(
                  page?.pageComponents ?? [],
                  page?.pageComponentGroups ?? [],
                )}
                onSubmit={async (values) => {
                  await createMaintenanceMutation.mutateAsync({
                    pageId,
                    title: values.title,
                    message: values.message,
                    startDate: values.startDate,
                    endDate: values.endDate,
                    pageComponents: values.pageComponents,
                    notifySubscribers: values.notifySubscribers,
                  });
                  setOpen(false);
                }}
              />
            </FormCard>
          </FormCardGroup>
        ) : (
          <EmptyStateContainer className="m-4">
            <EmptyStateTitle>
              {pages?.length === 0
                ? "No status pages found"
                : "Select a status page"}
            </EmptyStateTitle>
          </EmptyStateContainer>
        )}
        <FormSheetFooter>
          <Button
            type="submit"
            form="maintenance-form"
            disabled={pageId === undefined}
          >
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
