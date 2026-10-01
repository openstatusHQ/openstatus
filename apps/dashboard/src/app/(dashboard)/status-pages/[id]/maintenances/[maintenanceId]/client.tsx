"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict } from "date-fns";

import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailInput,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailMetaTime,
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
import { useUpdateMaintenance } from "@/components/maintenances/use-update-maintenance";
import { Notifications } from "@/components/status-pages/notifications";
import { getMaintenanceStatus } from "@/data/overview-events.client";
import { getPageUrl } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";

export function Client({ id, pageId }: { id: number; pageId: number }) {
  const trpc = useTRPC();
  const { data: maintenance } = useQuery(
    trpc.maintenance.get.queryOptions({ id }),
  );
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const rename = useUpdateMaintenance(id);

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
              onCommit={(title) => rename.update({ title })}
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
            <DetailMetaTime date={maintenance.from} />
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
          <DetailSection>
            <DetailSectionTitle>Affected components</DetailSectionTitle>
            <MaintenanceComponents
              maintenance={maintenance}
              components={page.pageComponents}
              groups={page.pageComponentGroups}
            />
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
    </SectionGroup>
  );
}
