"use client";

import { Add } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { FormMaintenanceUpdateCard } from "@/components/forms/maintenance-update/card";
import { FormSheetMaintenanceUpdate } from "@/components/forms/maintenance-update/sheet";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { maintenanceId } = useParams<{
    id: string;
    maintenanceId: string;
  }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const input = { id: Number.parseInt(maintenanceId) };
  const { data: maintenance, refetch } = useQuery(
    trpc.maintenance.get.queryOptions(input),
  );

  const invalidateMaintenanceQueries = () => {
    refetch();
    queryClient.invalidateQueries({
      queryKey: trpc.maintenance.list.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.page.list.queryKey(),
    });
  };

  const notifyMutation = useMutation(
    trpc.subscriberNotification.maintenance.mutationOptions(),
  );
  const createMutation = useMutation(
    trpc.maintenance.createUpdate.mutationOptions({
      onSuccess: (update) => {
        if (update?.notifySubscribers) {
          notifyMutation.mutate({ id: update.id });
        }
        invalidateMaintenanceQueries();
      },
    }),
  );
  const updateMutation = useMutation(
    trpc.maintenance.updateUpdate.mutationOptions({
      onSuccess: invalidateMaintenanceQueries,
    }),
  );
  const deleteMutation = useMutation(
    trpc.maintenance.deleteUpdate.mutationOptions({
      onSuccess: invalidateMaintenanceQueries,
    }),
  );

  if (!maintenance) return null;

  const updates = [...maintenance.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
  );
  const affected = maintenance.pageComponents
    .map((component) => component.name)
    .join(", ");

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{maintenance.title}</SectionTitle>
            <SectionDescription>
              {format(maintenance.from, "PPP 'at' p")} –{" "}
              {format(maintenance.to, "PPP 'at' p")}. Affects{" "}
              <span className="text-foreground">{affected || "zero"}</span>{" "}
              component(s).
            </SectionDescription>
          </SectionHeader>
        </SectionHeaderRow>

        <EmptyStateContainer className="my-8 border-dashed">
          <EmptyStateDescription>Maintenance Updates</EmptyStateDescription>
          <FormSheetMaintenanceUpdate
            onSubmit={async (values) => {
              await createMutation.mutateAsync({
                maintenanceId: maintenance.id,
                message: values.message,
                date: values.date,
                notifySubscribers: values.notifySubscribers,
              });
            }}
          >
            <Button size="sm">
              <Add />
              Create Maintenance Update
            </Button>
          </FormSheetMaintenanceUpdate>
        </EmptyStateContainer>

        <FormCardGroup>
          {updates.map((update, index) => (
            <FormSheetWithDirtyProtection key={update.id}>
              <FormMaintenanceUpdateCard
                index={index}
                total={updates.length}
                update={update}
                onSubmit={async (values) => {
                  await updateMutation.mutateAsync({
                    id: update.id,
                    message: values.message,
                    date: values.date,
                  });
                }}
                onDelete={async () => {
                  await deleteMutation.mutateAsync({ id: update.id });
                }}
              />
            </FormSheetWithDirtyProtection>
          ))}
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
