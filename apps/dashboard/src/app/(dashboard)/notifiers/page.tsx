"use client";

import { Link } from "@/components/common/link";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import { ActionCardGroup } from "@/components/content/action-card";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/notifiers/columns";
import { FormSheetNotifier } from "@/components/forms/notifier/sheet";
import { DataTable } from "@/components/ui/data-table/data-table";
import { config } from "@/data/notifiers.client";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function Page() {
  const trpc = useTRPC();
  const { data: notifiers, refetch } = useQuery(
    trpc.notification.list.queryOptions()
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const createNotifierMutation = useMutation(
    trpc.notification.new.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  if (!notifiers || !monitors || !workspace) return null;

  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Notifiers</SectionTitle>
      </SectionHeader>
      <Section>
        {notifiers.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No notifier found</EmptyStateTitle>
          </EmptyStateContainer>
        ) : (
          <DataTable columns={columns} data={notifiers} />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Create a new notifier</SectionTitle>
          <SectionDescription>
            Define your notifiers to receive notifications when incidents.{" "}
            <Link href="#">Learn more</Link>.
          </SectionDescription>
        </SectionHeader>
        <ActionCardGroup className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Object.keys(config).map((notifier) => {
            const key = notifier as keyof typeof config;
            const Icon = config[key].icon;
            let enabled = true;

            if (key in workspace.limits) {
              enabled =
                workspace.limits[key as "opsgenie" | "sms" | "opsgenie"];
            }

            return (
              <FormSheetNotifier
                key={notifier}
                provider={key}
                monitors={monitors}
                onSubmit={async (values) => {
                  await createNotifierMutation.mutateAsync({
                    provider: key,
                    name: values.name,
                    data: { [key]: values.data },
                    monitors: values.monitors,
                  });
                }}
                disabled={!enabled}
              >
                <ActionCard className="h-full w-full">
                  <ActionCardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-md border border-border bg-muted">
                        <Icon className="size-3" />
                      </div>
                      <ActionCardTitle>{config[key].label}</ActionCardTitle>
                    </div>
                    <ActionCardDescription>
                      Send notifications to {config[key].label}
                    </ActionCardDescription>
                  </ActionCardHeader>
                </ActionCard>
              </FormSheetNotifier>
            );
          })}
          <ActionCard className="border-dashed">
            <ActionCardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md border border-border bg-muted" />
                <ActionCardTitle className="text-muted-foreground">
                  Your Notifier
                </ActionCardTitle>
              </div>
              <ActionCardDescription>
                Missing a channel?{" "}
                <Link href="mailto:ping@openstatus.dev">Contact us</Link>
              </ActionCardDescription>
            </ActionCardHeader>
          </ActionCard>
        </ActionCardGroup>
      </Section>
    </SectionGroup>
  );
}
