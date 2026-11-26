"use client";

import {
  builtinPlaybookSlugs,
  isBuiltinPlaybookSlug,
  PLAYBOOK_MAX_CUSTOM,
  playbookDefaultDescription,
  playbookDefaultTitle,
} from "@openstatus/db/src/schema/playbooks/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

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
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { PlaybookRowActions } from "@/components/data-table/playbooks/data-table-row-actions";
import { FormSheetPlaybook } from "@/components/forms/playbook/sheet";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: playbooks } = useQuery(trpc.playbook.list.queryOptions());
  const create = useMutation(
    trpc.playbook.save.mutationOptions({
      onSuccess: async (playbook) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.playbook.pathKey(),
        });
        if (playbook) router.push(`/agents/playbooks/${playbook.slug}`);
      },
    }),
  );
  const custom = (playbooks ?? [])
    .map((p) => p.slug)
    .filter((slug) => !isBuiltinPlaybookSlug(slug));
  // built-in slugs always have a row, written or not
  const slugs = [...builtinPlaybookSlugs, ...custom];

  return (
    <SectionGroup>
      <Section id="playbooks">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Playbooks</SectionTitle>
            <SectionDescription>
              Write down how your team runs things. The agent reads your
              playbooks before it drafts a status report, a maintenance notice
              or a postmortem, so your team and the agent are aligned by
              default.
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetPlaybook
              takenSlugs={custom}
              onSubmit={async (values) => {
                await create.mutateAsync({
                  ...values,
                  // a playbook cannot be empty; the text is written on its page
                  content: `# ${values.title}`,
                });
              }}
            >
              <Button
                data-section="action"
                size="sm"
                disabled={custom.length >= PLAYBOOK_MAX_CUSTOM}
              >
                Create playbook
              </Button>
            </FormSheetPlaybook>
          </div>
        </SectionHeaderRow>
        <EventList>
          {slugs.map((slug) => {
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
                    {playbook?.title ?? playbookDefaultTitle(slug)}
                  </EventRowTitle>
                  <EventRowMeta>
                    <span>
                      {playbook?.description ??
                        playbookDefaultDescription(slug)}
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
