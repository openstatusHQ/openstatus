"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { format, formatDistanceStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailInput,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailSection,
  DetailSectionTitle,
  DetailTitle,
  DetailTitleRow,
} from "@/components/content/detail";
import { ProcessMessage } from "@/components/content/process-message";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { SectionGroup } from "@/components/content/section";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { MaintenanceActions } from "@/components/maintenances/maintenance-actions";
import { AffectedComponents } from "@/components/status-reports/status-report-components";
import { Notifications } from "@/components/status-reports/status-report-notifications";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { maintenanceStatusVariants } from "@/data/maintenances.client";
import {
  getMaintenanceStatus,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { getPageUrl } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";

function MetaDate({ date }: { date: Date }) {
  return (
    <HoverCardTimestamp date={date} side="bottom">
      <time dateTime={date.toISOString()} className="text-foreground font-mono">
        {format(date, "LLL dd, HH:mm")}
      </time>
    </HoverCardTimestamp>
  );
}

function PropertyDate({ date }: { date: Date }) {
  return (
    <HoverCardTimestamp date={date} side="left">
      <span>{format(date, "LLL dd, y HH:mm")}</span>
    </HoverCardTimestamp>
  );
}

export function Client({ id, pageId }: { id: number; pageId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: maintenance } = useQuery(
    trpc.maintenance.get.queryOptions({ id }),
  );
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const [editing, setEditing] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.maintenance.get.queryKey({ id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.maintenance.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.page.list.queryKey(),
      }),
    ]);
  const update = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  if (!maintenance || !page) return null;

  const status = getMaintenanceStatus(maintenance);
  const config = maintenanceStatusConfig[status];
  const publicUrl = `${getPageUrl(page)}/events/maintenance/${maintenance.id}`;
  const duration = formatDistanceStrict(maintenance.from, maintenance.to);
  // every field is required on update: spread the current row first
  const current = {
    id: maintenance.id,
    title: maintenance.title,
    message: maintenance.message,
    startDate: maintenance.from,
    endDate: maintenance.to,
    pageComponents: maintenance.pageComponentIds,
  };

  return (
    <SectionGroup>
      <DetailHeader>
        <DetailTitleRow>
          <DetailTitle>
            <DetailInput
              aria-label="Title"
              required
              maxLength={256}
              disabled={update.isPending}
              value={maintenance.title}
              onCommit={(title) => update.mutate({ ...current, title })}
            />
          </DetailTitle>
          <DetailActions>
            <MaintenanceActions
              maintenance={maintenance}
              onEdit={() => setEditing(true)}
            />
          </DetailActions>
        </DetailTitleRow>
        <DetailMeta>
          <DetailMetaItem>
            {status === "scheduled" ? "Starts" : "Started"}{" "}
            <MetaDate date={maintenance.from} />
          </DetailMetaItem>
          <DetailMetaItem>
            {status === "completed" ? "Lasted" : "Lasts"}{" "}
            <span className="text-foreground font-mono">{duration}</span>
          </DetailMetaItem>
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <DetailSection>
            <DetailSectionTitle variant="heading">Message</DetailSectionTitle>
            {maintenance.message.trim() ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ProcessMessage value={maintenance.message} />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No message.</p>
            )}
          </DetailSection>
        </DetailMain>
        <DetailAside>
          <DetailSection>
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <PropertyList>
              <Property>
                <PropertyLabel>Status</PropertyLabel>
                <PropertyValue>
                  <StatusDot variant={maintenanceStatusVariants[status]} />
                  {config.label}
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Status page</PropertyLabel>
                <PropertyValue>
                  <Link
                    href={`/status-pages/${pageId}/maintenances`}
                    className="truncate font-normal"
                  >
                    {page.title}
                  </Link>
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>From</PropertyLabel>
                <PropertyValue>
                  <PropertyDate date={maintenance.from} />
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>To</PropertyLabel>
                <PropertyValue>
                  <PropertyDate date={maintenance.to} />
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Duration</PropertyLabel>
                <PropertyValue>
                  {duration}
                  {status === "in-progress" ? (
                    <>
                      <StatusDot variant="warning" className="size-1.5" />
                      <span className="sr-only">in progress</span>
                    </>
                  ) : null}
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Timezone</PropertyLabel>
                <PropertyValue>
                  <span className="truncate" suppressHydrationWarning>
                    {timezone}
                  </span>
                </PropertyValue>
              </Property>
            </PropertyList>
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Affected components</DetailSectionTitle>
            <AffectedComponents components={maintenance.pageComponents} />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Notifications</DetailSectionTitle>
            <Notifications
              pageId={pageId}
              publicUrl={publicUrl}
              description="Customers can see this maintenance on your status page."
            />
          </DetailSection>
        </DetailAside>
      </DetailContent>
      <FormSheetMaintenance
        open={editing}
        onOpenChange={setEditing}
        items={toCheckboxTreeItems(
          page.pageComponents,
          page.pageComponentGroups,
        )}
        defaultValues={{
          title: maintenance.title,
          message: maintenance.message,
          startDate: maintenance.from,
          endDate: maintenance.to,
          pageComponents: maintenance.pageComponentIds,
        }}
        onSubmit={async (values) => {
          await update.mutateAsync({
            id: maintenance.id,
            title: values.title,
            message: values.message,
            startDate: values.startDate,
            endDate: values.endDate,
            pageComponents: values.pageComponents,
          });
        }}
      />
    </SectionGroup>
  );
}
