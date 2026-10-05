"use client";

import type { IncidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { personName } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { useState } from "react";

import { Link } from "@/components/common/link";
import {
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailMetaTime,
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
import { Timeline } from "@/components/content/timeline";
import {
  IncidentActions,
  hasIncidentActions,
} from "@/components/incidents/incident-actions";
import { IncidentComposer } from "@/components/incidents/incident-composer";
import { IncidentHeading } from "@/components/incidents/incident-heading";
import { IncidentPostmortem } from "@/components/incidents/incident-postmortem";
import { IncidentProperties } from "@/components/incidents/incident-properties";
import { IncidentStatusReport } from "@/components/incidents/incident-status-report";
import { IncidentTimelineItem } from "@/components/incidents/incident-timeline";
import { ResolveReportDialog } from "@/components/incidents/resolve-report-dialog";
import { incidentEndedAt } from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";

function slackChannelUrl(teamId: string, channelId: string): string {
  return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}`;
}

export function Client({ id }: { id: number }) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: incident, isError } = useQuery({
    ...trpc.incident.get.queryOptions({ id }),
    retry: false,
  });
  const { data: events } = useQuery(
    trpc.incident.listEvents.queryOptions({ id }),
  );
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

  const resolved = incident.status === "resolved";
  const timeline = (
    <DetailSection>
      <DetailSectionTitle variant="heading">
        Timeline
        {events ? (
          <span className="text-muted-foreground ml-2 font-mono text-xs font-normal">
            {events.length}
          </span>
        ) : null}
      </DetailSectionTitle>
      <Timeline>
        {closed ? null : (
          <IncidentComposer
            incident={incident}
            onStatusChanged={onStatusChanged}
          />
        )}
        {events?.map((event) => (
          <IncidentTimelineItem key={event.id} event={event} />
        ))}
      </Timeline>
    </DetailSection>
  );
  const postmortem = (
    <DetailSection>
      <DetailSectionTitle variant="heading">Postmortem</DetailSectionTitle>
      <IncidentPostmortem
        incident={incident}
        agentAllowed={workspace?.limits["slack-agent"] === true}
      />
    </DetailSection>
  );

  return (
    <SectionGroup>
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
            <DetailMetaTime date={incident.declaredAt}>
              {formatDistanceToNow(incident.declaredAt, { addSuffix: true })}
            </DetailMetaTime>
          </DetailMetaItem>
          {incident.closedAt ? (
            <DetailMetaItem>
              Closed
              <DetailMetaTime date={incident.closedAt}>
                {formatDistanceToNow(incident.closedAt, { addSuffix: true })}
              </DetailMetaTime>
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
          {/* Resolved incidents lead with the postmortem; open ones with the timeline. */}
          {resolved ? postmortem : timeline}
          {resolved ? timeline : postmortem}
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
