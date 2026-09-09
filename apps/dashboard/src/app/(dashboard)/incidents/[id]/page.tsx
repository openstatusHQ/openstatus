"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { useTRPC } from "@/lib/trpc/client";

import { PromoteDialog } from "./promote-dialog";

const ORIGIN_LABEL = {
  monitor: "openstatus monitor",
  external: "Ingested alert",
  manual: "Opened by hand",
} as const;

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: incident } = useQuery(trpc.incident.get.queryOptions({ id }));
  const { data: auditLogs } = useQuery(
    trpc.auditLog.list.queryOptions({
      entityType: "incident",
      entityId: String(id),
      limit: 100,
      offset: 0,
    }),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.incident.list.queryKey() });
    queryClient.invalidateQueries({
      queryKey: trpc.incident.get.queryKey({ id }),
    });
    queryClient.invalidateQueries({ queryKey: trpc.auditLog.list.queryKey() });
  };

  const acknowledge = useMutation(
    trpc.incident.acknowledge.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
  const resolve = useMutation(
    trpc.incident.resolve.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!incident) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{incident.title}</SectionTitle>
            <SectionDescription>
              {ORIGIN_LABEL[incident.origin]} · started{" "}
              {incident.startedAt.toLocaleString()}
            </SectionDescription>
          </SectionHeader>
          <div className="flex gap-2">
            {!incident.acknowledgedAt && !incident.resolvedAt ? (
              <Button
                variant="outline"
                disabled={acknowledge.isPending}
                onClick={() => acknowledge.mutate({ id })}
              >
                Acknowledge
              </Button>
            ) : null}
            {!incident.resolvedAt ? (
              <Button
                variant="outline"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id })}
              >
                Resolve
              </Button>
            ) : null}
            {!incident.statusReportId ? (
              <PromoteDialog incidentId={id} defaultTitle={incident.title} />
            ) : null}
          </div>
        </SectionHeaderRow>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{incident.status}</Badge>
          <Badge
            variant={
              incident.severity === "critical" ? "destructive" : "secondary"
            }
          >
            {incident.severity}
          </Badge>
          {incident.autoResolved ? (
            <Badge variant="secondary">auto-resolved</Badge>
          ) : null}
          {incident.statusReportId ? (
            <Badge variant="secondary">
              published as report #{incident.statusReportId}
            </Badge>
          ) : null}
        </div>
        {incident.summary ? (
          <p className="text-muted-foreground text-sm">{incident.summary}</p>
        ) : null}
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>History</SectionTitle>
          <SectionDescription>
            Incidents have no separate timeline — this is the audit log.
          </SectionDescription>
        </SectionHeader>
        {!auditLogs || auditLogs.items.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No recorded changes yet</EmptyStateTitle>
          </EmptyStateContainer>
        ) : (
          <ul className="divide-y rounded-md border">
            {auditLogs.items.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
              >
                <span className="font-mono">{entry.action}</span>
                <span className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </SectionGroup>
  );
}
