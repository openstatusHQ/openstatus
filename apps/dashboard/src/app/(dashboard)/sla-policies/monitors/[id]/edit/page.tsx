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
import { FormMonitorSlaPolicyUpdate } from "@/components/forms/monitor-sla-policy/update";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: policy } = useQuery(
    trpc.monitorSlaPolicy.summary.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!policy) return null;

  return (
    <SectionGroup>
      <Section id="settings">
        <SectionHeader>
          <SectionTitle>{policy.name}</SectionTitle>
          <SectionDescription>
            {policy.archivedAt
              ? "This policy is archived. Its terms and monitors are read-only."
              : "Previews follow every change. Sealed months keep the terms they were judged with."}
          </SectionDescription>
        </SectionHeader>
        <fieldset
          disabled={!!policy.archivedAt}
          className="contents"
          aria-label="Policy settings"
        >
          <FormMonitorSlaPolicyUpdate />
        </fieldset>
      </Section>
    </SectionGroup>
  );
}
