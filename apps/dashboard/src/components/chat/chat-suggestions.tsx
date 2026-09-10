import { ModelContextProtocolIcon } from "@openstatus/icons/brand";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import NextLink from "next/link";

import { Note, NoteButton } from "@/components/common/note";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

const SUGGESTIONS = [
  "List all my monitors",
  "Are any status reports unresolved?",
  "Draft a status report",
  "Schedule a maintenance window",
];

type Props = {
  onSelect: (text: string) => void;
};

export function ChatSuggestions({ onSelect }: Props) {
  return (
    <SectionGroup className="mx-auto max-w-3xl">
      <Section className="flex w-full flex-col items-center">
        <SectionHeader className="max-w-2xl text-center">
          <SectionTitle>openstatus assistant</SectionTitle>
          <SectionDescription>
            Ask about your workspace, draft status reports, or debug your
            failing monitors.{" "}
            <span className="text-muted-foreground/80">
              Test it out and share your feedback.
            </span>{" "}
            <Badge variant="secondary" className="bg-info/10 text-info">
              BETA
            </Badge>
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="rounded-full px-4"
              onClick={() => onSelect(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </Section>
      <Section className="flex w-full flex-col items-center">
        <Note size="sm" className="text-muted-foreground w-full max-w-2xl">
          <ModelContextProtocolIcon />
          Prefer your own tools? Connect Claude Code, Cursor or ChatGPT to this
          workspace through the openstatus MCP server.
          <NoteButton variant="outline" size="sm" asChild>
            <NextLink href="/agents/mcp">Set up MCP</NextLink>
          </NoteButton>
        </Note>
      </Section>
    </SectionGroup>
  );
}
