"use client";

import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { ExternalLink, Notification } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useQueryStates } from "nuqs";
import { useState } from "react";

import { Link } from "@/components/common/link";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardGroup,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import {
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMedia,
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
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetNotifier } from "@/components/forms/notifications/sheet";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import {
  type NotifierProvider,
  config,
  hiddenProviders,
} from "@/data/notifications.client";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

// FIXME: WARNING we are using the `web` api url here
const BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.openstatus.dev";

const planGated = [
  "pagerduty",
  "opsgenie",
  "grafana-oncall",
  "whatsapp",
] as const satisfies readonly (NotifierProvider & keyof Limits)[];

type PlanGatedProvider = (typeof planGated)[number];

function isPlanGated(
  provider: NotifierProvider,
): provider is PlanGatedProvider {
  return planGated.some((gated) => gated === provider);
}

// Spreads its props: `FormSheetTrigger asChild` hands the click handler to it.
function NotifierCard({
  provider,
  className,
  ...props
}: React.ComponentProps<typeof ActionCard> & { provider: NotifierProvider }) {
  const { icon: Icon, label } = config[provider];
  return (
    <ActionCard className={cn("h-full w-full", className)} {...props}>
      <ActionCardHeader>
        <div className="flex items-center gap-2">
          <div className="border-border bg-muted flex size-6 items-center justify-center rounded-md border">
            <Icon className="size-3" />
          </div>
          <ActionCardTitle>{label}</ActionCardTitle>
        </div>
        <ActionCardDescription>
          Send notifications to {label}
        </ActionCardDescription>
      </ActionCardHeader>
    </ActionCard>
  );
}

export function Client() {
  const trpc = useTRPC();
  const { data: notifications, refetch } = useQuery(
    trpc.notification.list.queryOptions(),
  );
  const [searchParams] = useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const createNotifierMutation = useMutation(
    trpc.notification.new.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  const [paywall, setPaywall] = useState<keyof Limits | null>(null);

  if (!notifications || !monitors || !workspace) return null;

  const limitReached =
    notifications.length >= workspace.limits["notification-channels"];

  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Notifications</SectionTitle>
        <SectionDescription>
          Define your notifications to receive alerts when downtime occurs.
        </SectionDescription>
      </SectionHeader>
      <Section id="notifiers">
        <DataTable
          paginationComponent={DataTablePaginationSimple}
          columns={columns}
          data={notifications}
          emptyState={
            <DataTableEmpty>
              <EmptyStateMedia>
                <Notification />
              </EmptyStateMedia>
              <EmptyStateTitle>No notification channels yet</EmptyStateTitle>
              <EmptyStateDescription>
                A channel receives an alert when a monitor fails or recovers.
                Connect one below and attach it to your monitors.
              </EmptyStateDescription>
              <EmptyStateActions>
                <Button size="sm" asChild>
                  <a href="#notifier-channels">Choose a channel</a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <NextLink
                    href="https://www.openstatus.dev/docs/reference/notification"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink />
                    Read the docs
                  </NextLink>
                </Button>
              </EmptyStateActions>
            </DataTableEmpty>
          }
        />
      </Section>
      <Section id="notifier-channels" className="scroll-mt-20">
        <SectionHeader>
          <SectionTitle>Create a new notifier</SectionTitle>
          <SectionDescription>
            Define your notifications to receive alerts when downtime occurs.{" "}
            <Link
              href="https://www.openstatus.dev/docs/reference/notification"
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
            const key = notifier as NotifierProvider;
            if (hiddenProviders.has(key)) return null;
            const locked = isPlanGated(key) && !workspace.limits[key];

            if (locked || limitReached) {
              return (
                <button
                  key={key}
                  type="button"
                  className="cursor-pointer text-left"
                  onClick={() =>
                    setPaywall(locked ? key : "notification-channels")
                  }
                >
                  <NotifierCard provider={key} />
                </button>
              );
            }

            if (!searchParams.channel && key === "pagerduty") {
              const PAGERDUTY_URL = `https://app.pagerduty.com/install/integration?app_id=${process.env.NEXT_PUBLIC_PAGERDUTY_APP_ID}&redirect_url=${BASE_URL}/api/callback/pagerduty?workspace=${workspace.slug}&version=2`;
              return (
                <a key={key} href={PAGERDUTY_URL}>
                  <NotifierCard provider={key} />
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
              >
                <NotifierCard provider={key} />
              </FormSheetNotifier>
            );
          })}
          <ActionCard className="border-dashed">
            <ActionCardHeader>
              <div className="flex items-center gap-2">
                <div className="border-border bg-muted flex size-6 items-center justify-center rounded-md border" />
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
        <UpgradeDialog
          open={paywall !== null}
          onOpenChange={(open) => !open && setPaywall(null)}
          limit={paywall ?? undefined}
        />
      </Section>
    </SectionGroup>
  );
}
