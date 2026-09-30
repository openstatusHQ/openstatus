"use client";

import type { IncidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { useState } from "react";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { Link } from "@/components/common/link";
import {
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailSection,
  DetailSectionTitle,
} from "@/components/content/detail";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { SectionGroup } from "@/components/content/section";
import {
  IncidentActions,
  hasIncidentActions,
} from "@/components/incidents/incident-actions";
import { IncidentComposer } from "@/components/incidents/incident-composer";
import { IncidentHeading } from "@/components/incidents/incident-heading";
import { IncidentPostmortem } from "@/components/incidents/incident-postmortem";
import { IncidentProperties } from "@/components/incidents/incident-properties";
import { IncidentStatusReport } from "@/components/incidents/incident-status-report";
import { IncidentTimeline } from "@/components/incidents/incident-timeline";
import { ResolveReportDialog } from "@/components/incidents/resolve-report-dialog";
import { incidentEndedAt, personName } from "@/data/managed-incidents.client";
import { useFeature } from "@/hooks/use-feature";
import { useTRPC } from "@/lib/trpc/client";

function slackChannelUrl(teamId: string, channelId: string): string {
  return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}`;
}

export function Client({ id }: { id: number }) {
  const trpc = useTRPC();
  const enabled = useFeature("incident-management");
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: incident, isError } = useQuery({
    ...trpc.incident.get.queryOptions({ id }),
    enabled,
    retry: false,
  });
  const { data: events } = useQuery({
    ...trpc.incident.listEvents.queryOptions({ id }),
    enabled,
  });
  const [followUp, setFollowUp] = useState<{ note: string } | null>(null);

  if (isError) {
    return (
      <SectionGroup>
        <EmptyStateContainer>
          <EmptyStateTitle>Incident not found</EmptyStateTitle>
        </EmptyStateContainer>
      </SectionGroup>
    );
  }
  if (!incident) return null;

  const canNotify = workspace?.limits["status-subscribers"] === true;
  const report = incident.statusReport;
  const closed = incident.closedAt !== null;
  const endedAt = incidentEndedAt(incident);
  const onStatusChanged = (status: IncidentStatus, note: string) => {
    if (
      (status === "resolved" || status === "canceled") &&
      report &&
      report.status !== "resolved"
    ) {
      setFollowUp({
        note:
          note ||
          (status === "resolved"
            ? "This incident has been resolved."
            : "This was a false alarm. Everything is operating normally."),
      });
    }
  };

  return (
    <SectionGroup className="max-w-6xl">
      <DetailHeader>
        <IncidentHeading
          incident={incident}
          actions={
            hasIncidentActions(incident) ? (
              <IncidentActions incident={incident} />
            ) : null
          }
        />
        <DetailMeta>
          <DetailMetaItem>
            Declared by
            <span className="text-foreground">
              {personName(incident.declaredByUser) ?? "System"}
            </span>
          </DetailMetaItem>
          <DetailMetaItem>
            <HoverCardTimestamp date={incident.declaredAt} side="bottom">
              <time dateTime={incident.declaredAt.toISOString()}>
                {formatDistanceToNow(incident.declaredAt, { addSuffix: true })}
              </time>
            </HoverCardTimestamp>
          </DetailMetaItem>
          {incident.closedAt ? (
            <DetailMetaItem>
              Closed
              <HoverCardTimestamp date={incident.closedAt} side="bottom">
                <time dateTime={incident.closedAt.toISOString()}>
                  {formatDistanceToNow(incident.closedAt, { addSuffix: true })}
                </time>
              </HoverCardTimestamp>
            </DetailMetaItem>
          ) : (
            <DetailMetaItem>
              {endedAt ? "Lasted" : "Ongoing for"}
              <span className="text-foreground font-mono">
                {formatDistanceStrict(
                  incident.startedAt,
                  endedAt ?? new Date(),
                )}
              </span>
            </DetailMetaItem>
          )}
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <Tabs defaultValue="timeline" className="gap-4">
            <TabsList>
              <TabsTrigger value="timeline">
                Timeline
                {events ? (
                  <span className="text-muted-foreground font-mono text-xs">
                    {events.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="postmortem">Postmortem</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="flex flex-col gap-8">
              {closed ? null : (
                <IncidentComposer
                  incident={incident}
                  onStatusChanged={onStatusChanged}
                />
              )}
              <IncidentTimeline events={events ?? []} />
            </TabsContent>
            <TabsContent value="postmortem">
              <IncidentPostmortem
                incident={incident}
                agentAllowed={workspace?.limits["slack-agent"] === true}
              />
            </TabsContent>
          </Tabs>
        </DetailMain>
        <DetailAside>
          <DetailSection>
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <IncidentProperties
              incident={incident}
              lastUpdateAt={events?.[0]?.createdAt}
              onStatusChanged={onStatusChanged}
            />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Communication</DetailSectionTitle>
            <IncidentStatusReport incident={incident} canNotify={canNotify} />
            <PropertyList>
              <Property>
                <PropertyLabel>Slack</PropertyLabel>
                <PropertyValue>
                  {incident.slackTeamId && incident.slackChannelId ? (
                    <Link
                      href={slackChannelUrl(
                        incident.slackTeamId,
                        incident.slackChannelId,
                      )}
                    >
                      Open channel
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No channel</span>
                  )}
                </PropertyValue>
              </Property>
            </PropertyList>
          </DetailSection>
        </DetailAside>
      </DetailContent>
      {report ? (
        <ResolveReportDialog
          incidentId={incident.id}
          report={report}
          canNotify={canNotify}
          defaultMessage={followUp?.note ?? ""}
          open={followUp !== null}
          onOpenChange={(open) => {
            if (!open) setFollowUp(null);
          }}
        />
      ) : null}
    </SectionGroup>
  );
}
