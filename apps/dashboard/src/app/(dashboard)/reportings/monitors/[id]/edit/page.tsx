"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormMonitorReportingUpdate } from "@/components/forms/monitor-reporting/update";
import { ReportingPaywall } from "@/components/reportings/reporting-paywall";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const allowed = workspace?.limits["monitor-sla"] === true;
  const { data: policy } = useQuery({
    ...trpc.monitorReporting.summary.queryOptions({ id: Number.parseInt(id) }),
    enabled: allowed,
  });

  if (!workspace) return null;
  if (!allowed) return <ReportingPaywall />;
  if (!policy || !user || !members) return null;

  const role = members.find((m) => m.user.id === user.id)?.role;
  const canEdit = role === "owner" || role === "admin";

  return (
    <SectionGroup>
      <Section id="settings">
        <SectionHeader>
          <SectionTitle>{policy.name}</SectionTitle>
          <SectionDescription>
            {policy.archivedAt
              ? "This reporting is archived. Its terms and monitors are read-only."
              : canEdit
                ? "Previews follow every change. Sealed months keep the terms they were judged with."
                : "Only owners and admins can change the reporting."}
          </SectionDescription>
        </SectionHeader>
        <fieldset
          disabled={!!policy.archivedAt || !canEdit}
          className="contents"
          aria-label="Reporting settings"
        >
          <FormMonitorReportingUpdate />
        </fieldset>
      </Section>
    </SectionGroup>
  );
}
