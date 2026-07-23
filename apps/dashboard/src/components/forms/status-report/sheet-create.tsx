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
import { FormStatusReport } from "@/components/forms/status-report/form";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Create-report sheet with a status page selector — for surfaces that are
 * not scoped to a single page (e.g. /overview). `children` is the trigger.
 */
export function FormSheetStatusReportCreate({
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
  const { data: statusReports } = useQuery(
    trpc.statusReport.list.queryOptions({}),
  );

  const pageId =
    pages?.length === 1 ? pages[0].id : (selectedPageId ?? undefined);

  const { data: page } = useQuery(
    trpc.page.get.queryOptions(
      { id: pageId ?? 0 },
      { enabled: pageId !== undefined },
    ),
  );

  const sendStatusReportUpdateMutation = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );
  const createStatusReportMutation = useMutation(
    trpc.statusReport.create.mutationOptions({
      onSuccess: (statusReport) => {
        if (statusReport.notifySubscribers) {
          sendStatusReportUpdateMutation.mutate({ id: statusReport.id });
        }
        // no-input prefix key — matches every statusReport.list query
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  const unresolvedReport =
    pageId !== undefined
      ? statusReports?.find(
          (r) => r.pageId === pageId && r.status !== "resolved",
        )
      : undefined;

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      {children ? (
        <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      ) : null}
      <FormSheetContent className="sm:max-w-lg">
        <FormSheetHeader>
          <FormSheetTitle>Status Report</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the status of your report.
          </FormSheetDescription>
        </FormSheetHeader>
        {pages && pages.length > 1 ? (
          <>
            <div className="grid gap-1.5 px-4 py-4">
              <Label htmlFor="status-page-select">Status Page</Label>
              <Select
                value={pageId !== undefined ? String(pageId) : undefined}
                onValueChange={(value) => setSelectedPageId(Number(value))}
              >
                <SelectTrigger id="status-page-select" size="sm">
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
        {unresolvedReport ? (
          <>
            <p className="text-warning px-4 py-4 text-sm">
              An unresolved report already exists for this page. Consider adding
              a <span className="font-semibold">status report update</span>{" "}
              instead.
            </p>
            <Separator />
          </>
        ) : null}
        {pageId !== undefined ? (
          <FormCardGroup className="overflow-y-scroll">
            <FormCard className="overflow-auto rounded-none border-none">
              <FormStatusReport
                key={pageId}
                id="status-report-form"
                className="my-4"
                items={toCheckboxTreeItems(
                  page?.pageComponents ?? [],
                  page?.pageComponentGroups ?? [],
                )}
                onSubmit={async (values) => {
                  // NOTE: for type safety, we need to check if the values have a date property
                  // because of the union type
                  if ("date" in values) {
                    // every selected component gets an impact row — fresh
                    // reports are never legacy; fallback must match the
                    // picker's defaultImpact
                    const componentImpacts = values.pageComponents.map(
                      (pageComponentId) => ({
                        pageComponentId,
                        impact:
                          values.componentImpacts?.find(
                            (ci) => ci.pageComponentId === pageComponentId,
                          )?.impact ?? ("degraded_performance" as const),
                      }),
                    );
                    await createStatusReportMutation.mutateAsync({
                      title: values.title,
                      status: values.status,
                      pageId,
                      pageComponents: values.pageComponents,
                      componentImpacts,
                      date: values.date,
                      message: values.message,
                      notifySubscribers: values.notifySubscribers,
                    });
                    setOpen(false);
                  }
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
            form="status-report-form"
            disabled={pageId === undefined}
          >
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
