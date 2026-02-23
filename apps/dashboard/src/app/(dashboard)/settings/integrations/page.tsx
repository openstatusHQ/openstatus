"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { SlackIntegrationCard } from "./slack-card";

export default function Page() {
  const trpc = useTRPC();
  const { data: integrations } = useQuery(trpc.integration.list.queryOptions());

  if (!integrations) return null;

  const slackIntegration = integrations.find((i) => i.name === "slack-agent");

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Integrations</SectionTitle>
          <SectionDescription>
            Connect third-party services to your workspace.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <SlackIntegrationCard
            integration={
              slackIntegration
                ? {
                    id: slackIntegration.id,
                    externalId: slackIntegration.externalId,
                    data: slackIntegration.data as {
                      teamName?: string;
                    },
                  }
                : null
            }
          />
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
