"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { format, formatDistanceStrict } from "date-fns";
import { toast } from "sonner";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
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
import { SectionGroup } from "@/components/content/section";
import { MaintenanceActions } from "@/components/maintenances/maintenance-actions";
import { MaintenanceComponents } from "@/components/maintenances/maintenance-components";
import { MaintenanceComposer } from "@/components/maintenances/maintenance-composer";
import { MaintenanceProperties } from "@/components/maintenances/maintenance-properties";
import { useInvalidateMaintenance } from "@/components/maintenances/use-invalidate-maintenance";
import { Notifications } from "@/components/status-reports/status-report-notifications";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { toUpdateInput } from "@/data/maintenances.client";
import { getMaintenanceStatus } from "@/data/overview-events.client";
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

export function Client({ id, pageId }: { id: number; pageId: number }) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(id);
  const { data: maintenance } = useQuery(
    trpc.maintenance.get.queryOptions({ id }),
  );
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const rename = useMutation(
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
  const publicUrl = `${getPageUrl(page)}/events/maintenance/${maintenance.id}`;

  return (
    <SectionGroup>
      <DetailHeader>
        <DetailTitleRow>
          <DetailTitle>
            <DetailInput
              aria-label="Title"
              required
              maxLength={256}
              disabled={rename.isPending}
              value={maintenance.title}
              onCommit={(title) =>
                rename.mutate({ ...toUpdateInput(maintenance), title })
              }
            />
          </DetailTitle>
          <DetailActions>
            <MaintenanceActions
              maintenance={maintenance}
              publicUrl={publicUrl}
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
            <span className="text-foreground font-mono">
              {formatDistanceStrict(maintenance.from, maintenance.to)}
            </span>
          </DetailMetaItem>
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <DetailSection>
            <DetailSectionTitle variant="heading">Message</DetailSectionTitle>
            <MaintenanceComposer maintenance={maintenance} />
          </DetailSection>
        </DetailMain>
        <DetailAside>
          <DetailSection>
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <MaintenanceProperties
              maintenance={maintenance}
              page={page}
              status={status}
            />
          </DetailSection>
          <MaintenanceComponents
            maintenance={maintenance}
            items={toCheckboxTreeItems(
              page.pageComponents,
              page.pageComponentGroups,
            )}
          />
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
    </SectionGroup>
  );
}
