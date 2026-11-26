"use client";

import {
  playbookDefaultDescription,
  playbookDefaultTitle,
  playbookSlugs,
} from "@openstatus/db/src/schema/playbooks/constants";
import { useQuery } from "@tanstack/react-query";

import { StatusDot } from "@/components/common/status-dot";
import {
  EventList,
  EventRow,
  EventRowActor,
  EventRowContent,
  EventRowDate,
  EventRowMenu,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { PlaybookRowActions } from "@/components/data-table/playbooks/data-table-row-actions";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const { data: playbooks } = useQuery(trpc.playbook.list.queryOptions());

  return (
    <SectionGroup>
      <Section id="playbooks">
        <SectionHeader>
          <SectionTitle>Playbooks</SectionTitle>
          <SectionDescription>
            Write down how your team runs things. The agent reads your playbooks
            before it drafts a status report, a maintenance notice or a
            postmortem, so your team and the agent are aligned by default.
          </SectionDescription>
        </SectionHeader>
        <EventList>
          {playbookSlugs.map((slug) => {
            const playbook = playbooks?.find((p) => p.slug === slug);
            return (
              <EventRow key={slug}>
                {playbook ? (
                  <EventRowDate date={playbook.updatedAt} />
                ) : (
                  <span className="text-muted-foreground/50 font-mono text-xs [grid-area:date]">
                    —
                  </span>
                )}
                <EventRowStatus>
                  <StatusDot variant={playbook ? "success" : "default"} />
                  <span>{playbook ? "Written" : "Empty"}</span>
                </EventRowStatus>
                <EventRowContent>
                  <EventRowTitle href={`/agents/playbooks/${slug}`}>
                    {playbook?.title ?? playbookDefaultTitle[slug]}
                  </EventRowTitle>
                  <EventRowMeta>
                    <span>
                      {playbook?.description ??
                        playbookDefaultDescription[slug]}
                    </span>
                  </EventRowMeta>
                </EventRowContent>
                <EventRowActor
                  actor={playbook?.updatedByUser ?? null}
                  label="Edited by"
                  optional
                />
                <EventRowMenu>
                  <PlaybookRowActions slug={slug} written={Boolean(playbook)} />
                </EventRowMenu>
              </EventRow>
            );
          })}
        </EventList>
      </Section>
    </SectionGroup>
  );
}
