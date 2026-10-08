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
import { Timeline } from "@/components/content/timeline";
import { MaintenanceActions } from "@/components/maintenances/maintenance-actions";
import { MaintenanceComponents } from "@/components/maintenances/maintenance-components";
import { MaintenanceComposer } from "@/components/maintenances/maintenance-composer";
import { MaintenanceProperties } from "@/components/maintenances/maintenance-properties";
import { MaintenanceUpdateComposer } from "@/components/maintenances/maintenance-update-composer";
import { MaintenanceUpdateTimelineItem } from "@/components/maintenances/maintenance-update-timeline";
import { useMaintenanceStatus } from "@/components/maintenances/use-maintenance-status";
import { useUpdateMaintenance } from "@/components/maintenances/use-update-maintenance";
import { Notifications } from "@/components/status-pages/notifications";
import { getPageUrl } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";

export function Client({ id, pageId }: { id: number; pageId: number }) {
  const trpc = useTRPC();
  const { data: maintenance } = useQuery(
    trpc.maintenance.get.queryOptions({ id }),
  );
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const rename = useUpdateMaintenance(id);
  const status = useMaintenanceStatus(
    maintenance ?? { from: new Date(0), to: new Date(0) },
  );

  if (!maintenance || !page) return null;

  const publicUrl = `${getPageUrl(page)}/events/maintenance/${maintenance.id}`;
  const canNotify = workspace?.limits["status-subscribers"] === true;
  const updates = [...maintenance.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
  );
  const latest = updates[0];

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
          {updates.length ? (
            <DetailMetaItem>
              {updates.length} {updates.length === 1 ? "update" : "updates"}
            </DetailMetaItem>
          ) : null}
          {latest ? (
            <DetailMetaItem>
              Last update <DetailMetaTime date={latest.date} />
            </DetailMetaItem>
          ) : null}
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <DetailSection>
            <DetailSectionTitle variant="heading">Message</DetailSectionTitle>
            <MaintenanceComposer maintenance={maintenance} />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle variant="heading">Updates</DetailSectionTitle>
            <Timeline>
              <MaintenanceUpdateComposer
                maintenance={maintenance}
                canNotify={canNotify}
              />
              {updates.map((update, i) => (
                <MaintenanceUpdateTimelineItem
                  key={update.id}
                  maintenance={maintenance}
                  update={update}
                  index={updates.length - i}
                />
              ))}
            </Timeline>
          </DetailSection>
        </DetailMain>
        <DetailAside>
          <DetailSection>
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <MaintenanceProperties
              maintenance={maintenance}
              page={page}
              status={status}
              publicUrl={publicUrl}
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
            <Notifications pageId={pageId} />
          </DetailSection>
        </DetailAside>
      </DetailContent>
    </SectionGroup>
  );
}
