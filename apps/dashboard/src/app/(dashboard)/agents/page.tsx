"use client";

import { Code } from "@/components/common/code";
import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { Section } from "@/components/content/section";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";

const messages = [
  {
    message:
      "@openstatus create an incident for the payment API – high latency detected.",
    description: "Open a new incident and notify your subscribers.",
  },
  {
    message:
      "@openstatus keep the status page updated that we are still monitoring the issue.",
    description: "Update the status report to 'Monitoring'.",
  },
  {
    message: "@openstatus resolve the ongoing incident on my API status page.",
    description: "Close an active incident and update your subscribers.",
  },
  {
    message:
      "@openstatus schedule a maintenance window for my database next Friday from 2–3 PM.",
    description: "Plan downtime so subscribers are informed in advance.",
  },
];

export default function Page() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Agents</SectionTitle>
          <SectionDescription>
            Use our Slack agent to manage your status pages and incidents.{" "}
            <Link
              href="https://www.openstatus.dev/blog/openstatus-slack-agent"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read more
            </Link>
            .
          </SectionDescription>
        </SectionHeader>
        {!workspace?.limits["slack-agent"] ? (
          <Note color="info" size="sm">
            <Info />
            This is a paid feature. Upgrade your plan to use the Slack agent.
          </Note>
        ) : null}
        <Button size="sm" asChild>
          <Link href="/settings/integrations">Install the Slack agent</Link>
        </Button>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Messages</SectionTitle>
          <SectionDescription>
            Here are some examples of messages that the Slack agent can handle.
          </SectionDescription>
        </SectionHeader>
        <Note size="sm">
          <Info />
          Mention the @openstatus bot to trigger a response. This keeps threads
          clean without the bot spamming your team.
        </Note>
        <ul className="flex flex-col gap-2">
          {messages.map((message, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <p className="text-muted-foreground text-xs">
                {message.description}
              </p>
              <Code>{message.message}</Code>
            </li>
          ))}
        </ul>
      </Section>
    </SectionGroup>
  );
}
