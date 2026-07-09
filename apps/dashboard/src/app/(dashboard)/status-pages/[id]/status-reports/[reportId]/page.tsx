"use client";

import { currentImpactsFromUpdates } from "@openstatus/db/src/schema/page_components/constants";
import { Add } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import {
  EmptyStateContainer,
  EmptyStateDescription,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormSheetWithDirtyProtection } from "@/components/forms/form-sheet";
import type { FormValues } from "@/components/forms/status-report-update/form";
import {
  FormStatusReportUpdateCard,
  type FormValues as UpdateCardFormValues,
} from "@/components/forms/status-report-update/form-status-report";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import {
  defaultComponentImpacts,
  getNextStatus,
  impactsEqual,
  toCreateStatusReportUpdateInput,
} from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { reportId } = useParams<{ id: string; reportId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: statusReport, refetch } = useQuery(
    trpc.statusReport.get.queryOptions({ id: Number.parseInt(reportId) }),
  );

  const sendStatusReportUpdateMutation = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );

  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: (update) => {
        if (update?.notifySubscribers) {
          sendStatusReportUpdateMutation.mutate({ id: update.id });
        }
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  const updateStatusReportUpdateMutation = useMutation(
    trpc.statusReport.updateStatusReportUpdate.mutationOptions({
      onSuccess: () => {
        refetch();
      },
    }),
  );

  if (!statusReport) return null;

  const updates = [...statusReport.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  const affected = statusReport.pageComponents
    .map((component) => component.name)
    .join(", ");

  const reportHasImpacts = statusReport.updates.some(
    (u) => u.componentImpacts.length > 0,
  );
  const currentImpacts = currentImpactsFromUpdates(statusReport.updates);
  const nextStatus = getNextStatus(statusReport.status);

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{statusReport.title}</SectionTitle>
            <SectionDescription>
              Manage updates for this status report. Affects{" "}
              <span className="text-foreground">
                {affected ? affected : "zero"}
              </span>{" "}
              component(s).
            </SectionDescription>
          </SectionHeader>
        </SectionHeaderRow>

        <EmptyStateContainer className="my-8 border-dashed">
          <EmptyStateDescription>Status Page Report</EmptyStateDescription>
          <FormSheetStatusReportUpdate
            defaultValues={{
              status: nextStatus,
              componentImpacts: defaultComponentImpacts({
                components: statusReport.pageComponents,
                currentImpacts,
                nextStatus,
              }),
            }}
            components={statusReport.pageComponents.map((c) => ({
              id: c.id,
              name: c.name,
            }))}
            onSubmit={async (values: FormValues) => {
              await createStatusReportUpdateMutation.mutateAsync(
                toCreateStatusReportUpdateInput({
                  statusReportId: statusReport.id,
                  values,
                  reportHasImpacts,
                }),
              );
            }}
          >
            <Button size="sm">
              <Add />
              Create Status Update
            </Button>
          </FormSheetStatusReportUpdate>
        </EmptyStateContainer>

        <FormCardGroup>
          {updates.map((update, index) => (
            <FormSheetWithDirtyProtection key={update.id}>
              <FormStatusReportUpdateCard
                id={`update-form-${update.id}`}
                index={index}
                update={update}
                components={statusReport.pageComponents.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
                defaultValues={{
                  status: update.status,
                  message: update.message,
                  date: update.date,
                  componentImpacts: update.componentImpacts.map((ci) => ({
                    pageComponentId: ci.pageComponentId,
                    impact: ci.impact,
                  })),
                }}
                onSubmit={async (values: UpdateCardFormValues) => {
                  await updateStatusReportUpdateMutation.mutateAsync({
                    id: update.id,
                    statusReportId: statusReport.id,
                    message: values.message,
                    status: values.status,
                    // replace-set semantics: only send when actually edited,
                    // so untouched (incl. legacy) updates keep their rows
                    componentImpacts: impactsEqual(
                      values.componentImpacts ?? [],
                      update.componentImpacts,
                    )
                      ? undefined
                      : values.componentImpacts,
                    date: values.date,
                  });
                }}
              />
            </FormSheetWithDirtyProtection>
          ))}
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
