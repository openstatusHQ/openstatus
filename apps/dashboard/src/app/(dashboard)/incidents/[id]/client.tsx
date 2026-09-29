"use client";

import type { IncidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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
import { IncidentComposer } from "@/components/incidents/incident-composer";
import { IncidentProperties } from "@/components/incidents/incident-properties";
import { IncidentStatusReport } from "@/components/incidents/incident-status-report";
import { IncidentTimeline } from "@/components/incidents/incident-timeline";
import { ResolveReportDialog } from "@/components/incidents/resolve-report-dialog";
import { severityConfig } from "@/data/managed-incidents.client";
import { useFeature } from "@/hooks/use-feature";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle className="flex items-center gap-2">
            {incident.title}
            <Badge
              variant="outline"
              className={cn(
                "font-mono",
                severityConfig[incident.severity].className,
              )}
            >
              {severityConfig[incident.severity].label}
            </Badge>
          </SectionTitle>
          {incident.summary ? (
            <SectionDescription>{incident.summary}</SectionDescription>
          ) : null}
        </SectionHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Tabs defaultValue="timeline" className="min-w-0">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="grid gap-6">
              {incident.closedAt === null ? (
                <IncidentComposer
                  incident={incident}
                  onStatusChanged={onStatusChanged}
                />
              ) : null}
              <IncidentTimeline events={events ?? []} />
            </TabsContent>
          </Tabs>
          <aside className="grid content-start gap-6">
            <IncidentProperties incident={incident} />
            <div className="grid gap-2 border-t pt-4">
              <h3 className="text-sm font-medium">Status report</h3>
              <IncidentStatusReport incident={incident} canNotify={canNotify} />
            </div>
          </aside>
        </div>
      </Section>
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
