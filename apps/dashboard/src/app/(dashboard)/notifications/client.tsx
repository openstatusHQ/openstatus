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
import { columns } from "@/components/data-table/notifications/columns";
import { FormSheetNotifier } from "@/components/forms/notifications/sheet";
import { DataTable } from "@/components/ui/data-table/data-table";
import { config } from "@/data/notifications.client";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";

// FIXME: WARNING we are using the `web` api url here
const BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.openstatus.dev";

export function Client() {
  const trpc = useTRPC();
  const { data: notifications, refetch } = useQuery(
    trpc.notification.list.queryOptions()
  );
  const [searchParams] = useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const createNotifierMutation = useMutation(
    trpc.notification.new.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  if (!notifications || !monitors || !workspace) return null;

  const limitReached =
    notifications.length >= workspace.limits["notification-channels"];

  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Notifications</SectionTitle>
      </SectionHeader>
      <Section>
        {notifications.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No notifier found</EmptyStateTitle>
          </EmptyStateContainer>
        ) : (
          <DataTable columns={columns} data={notifications} />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Create a new notifier</SectionTitle>
          <SectionDescription>
            Define your notifications to receive alerts when downtime occurs.{" "}
            <Link
              href="https://docs.openstatus.dev/alerting/overview/"
              rel="noreferrer"
              target="_blank"
            >
              Learn more
            </Link>
            .
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

            if (limitReached) {
              enabled = false;
            }

            if (!searchParams.channel && key === "pagerduty") {
              const PAGERDUTY_URL = `https://app.pagerduty.com/install/integration?app_id=${process.env.NEXT_PUBLIC_PAGERDUTY_APP_ID}&redirect_url=${BASE_URL}/api/callback/pagerduty?workspace=${workspace.slug}&version=2`;
              return (
                <a
                  key={key}
                  href={PAGERDUTY_URL}
                  data-disabled={!enabled}
                  className="data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none"
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
                </a>
              );
            }

            return (
              <FormSheetNotifier
                key={notifier}
                provider={key}
                monitors={monitors}
                defaultOpen={searchParams.channel === key}
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
