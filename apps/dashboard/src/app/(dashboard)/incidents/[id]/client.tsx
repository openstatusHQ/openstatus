"use client";

import {
  incidentUpdateCadence,
  isIncidentSystemEvent,
} from "@openstatus/db/src/schema/incident_sla_policies/cadence";
import {
  incidentAwaitsAcknowledgement,
  incidentSlaHeadline,
  incidentSlaState,
} from "@openstatus/db/src/schema/incident_sla_policies/state";
import type { IncidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { personName } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { useState } from "react";

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
import { SectionGroup } from "@/components/content/section";
import { Timeline } from "@/components/content/timeline";
import { IncidentAcknowledgeButton } from "@/components/incidents/incident-acknowledge-button";
import {
  IncidentActions,
  hasIncidentActions,
} from "@/components/incidents/incident-actions";
import { IncidentCommunication } from "@/components/incidents/incident-communication";
import { IncidentComposer } from "@/components/incidents/incident-composer";
import { IncidentHeading } from "@/components/incidents/incident-heading";
import { IncidentPostmortem } from "@/components/incidents/incident-postmortem";
import { IncidentProperties } from "@/components/incidents/incident-properties";
import { IncidentSla } from "@/components/incidents/incident-sla";
import {
  IncidentSlaBadge,
  IncidentUpdateBadge,
} from "@/components/incidents/incident-sla-badge";
import { IncidentTimelineItem } from "@/components/incidents/incident-timeline";
import { ResolveReportDialog } from "@/components/incidents/resolve-report-dialog";
import { incidentEndedAt } from "@/data/managed-incidents.client";
import { useNow } from "@/hooks/use-now";
import { useTRPC } from "@/lib/trpc/client";

export function Client({ id }: { id: number }) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: incident } = useQuery(trpc.incident.get.queryOptions({ id }));
  const { data: events } = useQuery(
    trpc.incident.listEvents.queryOptions({ id }),
  );
  const [followUp, setFollowUp] = useState<{ note: string } | null>(null);
  const now = useNow(30_000);

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
  const sla = incidentSlaState(incident, now);
  const slaHeadline = sla ? incidentSlaHeadline(sla) : null;
  const awaitsAcknowledgement = incidentAwaitsAcknowledgement(incident);
  const updateCadence = incidentUpdateCadence(
    incident,
    incident.updateActivity,
    now,
  );
  const lastUpdateAt = events?.find(
    (event) => !isIncidentSystemEvent(event.type),
  )?.createdAt;
  const timeline = (
    <DetailSection id="activity">
      <DetailSectionTitle variant="heading">
        Activity
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
          <IncidentTimelineItem
            key={event.id}
            event={event}
            incident={incident}
          />
        ))}
      </Timeline>
    </DetailSection>
  );
  const postmortem = (
    <DetailSection id="postmortem">
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
            awaitsAcknowledgement || hasIncidentActions(incident) ? (
              <>
                {awaitsAcknowledgement ? (
                  <IncidentAcknowledgeButton incidentId={incident.id} />
                ) : null}
                <IncidentActions incident={incident} />
              </>
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
          {slaHeadline ? (
            <DetailMetaItem>
              <IncidentSlaBadge
                timer={slaHeadline.timer}
                kind={slaHeadline.kind}
                now={now}
              />
            </DetailMetaItem>
          ) : null}
          {updateCadence?.status === "overdue" ? (
            <DetailMetaItem>
              <IncidentUpdateBadge
                cadence={updateCadence}
                kind="update"
                now={now}
              />
            </DetailMetaItem>
          ) : null}
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          {/* Resolved incidents lead with the postmortem; open ones with the
              timeline. A canceled one is a false alarm: no postmortem. */}
          {resolved ? postmortem : timeline}
          {resolved ? timeline : null}
          {resolved || incident.status === "canceled" ? null : postmortem}
        </DetailMain>
        <DetailAside>
          <DetailSection id="properties">
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <IncidentProperties
              incident={incident}
              lastUpdateAt={lastUpdateAt}
              onStatusChanged={onStatusChanged}
            />
          </DetailSection>
          {sla ? (
            <DetailSection id="sla">
              <DetailSectionTitle>SLA</DetailSectionTitle>
              <IncidentSla
                incidentId={incident.id}
                state={sla}
                cadence={updateCadence}
                now={now}
              />
            </DetailSection>
          ) : null}
          <DetailSection id="communication">
            <DetailSectionTitle>Communication</DetailSectionTitle>
            <IncidentCommunication incident={incident} />
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
