"use client";

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
import { FormAlertDialog } from "@/components/forms/form-alert-dialog";
import {
  FormCard,
  FormCardFooter,
  FormCardGroup,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { FormSheetWithDirtyProtection } from "@/components/forms/form-sheet";
import type { FormValues } from "@/components/forms/status-report-update/form";
import { FormStatusReportUpdateCard } from "@/components/forms/status-report-update/formcard";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

export default function Page() {
  const { id, reportId } = useParams<{ id: string; reportId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: statusReport, refetch } = useQuery(
    trpc.statusReport.get.queryOptions({ id: Number.parseInt(reportId) }),
  );

  const sendStatusReportUpdateMutation = useMutation(
    trpc.emailRouter.sendStatusReport.mutationOptions(),
  );

  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: (update) => {
        if (update?.notifySubscribers) {
          sendStatusReportUpdateMutation.mutateAsync({ id: update.id });
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

  const deleteStatusReportUpdateMutation = useMutation(
    trpc.statusReport.deleteUpdate.mutationOptions({
      onSuccess: () => {
        refetch();
      },
    }),
  );

  if (!statusReport) return null;

  const updates = [...statusReport.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{statusReport.title}</SectionTitle>
            <SectionDescription>
              Manage updates for this status report.
            </SectionDescription>
          </SectionHeader>
        </SectionHeaderRow>

        <EmptyStateContainer className="my-8 border-dashed">
          <EmptyStateDescription>Status Page Report</EmptyStateDescription>
          <FormSheetStatusReportUpdate
            onSubmit={async (values: FormValues) => {
              await createStatusReportUpdateMutation.mutateAsync({
                statusReportId: statusReport.id,
                message: values.message,
                status: values.status,
                date: values.date,
                notifySubscribers: values.notifySubscribers,
              });
            }}
          >
            <Button size="sm">
              <Plus />
              Create Status Update
            </Button>
          </FormSheetStatusReportUpdate>
        </EmptyStateContainer>

        <FormCardGroup>
          {updates.map((update, index) => (
            <FormSheetWithDirtyProtection key={update.id}>
              <FormCard>
                <FormCardHeader>
                  <FormCardTitle>
                    Status Report Update #{updates.length - index}
                  </FormCardTitle>
                </FormCardHeader>
                <FormStatusReportUpdateCard
                  id={`update-form-${update.id}`}
                  defaultValues={{
                    status: update.status,
                    message: update.message,
                    date: update.date,
                  }}
                  onSubmit={async (values: FormValues) => {
                    await updateStatusReportUpdateMutation.mutateAsync({
                      id: update.id,
                      statusReportId: statusReport.id,
                      message: values.message,
                      status: values.status,
                      date: values.date,
                    });
                  }}
                />
                <FormCardFooter className="[&>:last-child]:ml-0 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormAlertDialog
                    confirmationValue={update.status}
                    submitAction={async () => {
                      await deleteStatusReportUpdateMutation.mutateAsync({
                        id: update.id,
                      });
                    }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </FormAlertDialog>
                  <Button
                    type="submit"
                    form={`update-form-${update.id}`}
                    size="sm"
                  >
                    Submit
                  </Button>
                </FormCardFooter>
              </FormCard>
            </FormSheetWithDirtyProtection>
          ))}
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
