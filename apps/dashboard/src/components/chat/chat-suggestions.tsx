import { Button } from "@openstatus/ui/components/ui/button";

import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

const SUGGESTIONS = [
  "Show me my status pages",
  "What status reports are open?",
  "Draft a status report",
  "Schedule a maintenance window",
];

type Props = {
  onSelect: (text: string) => void;
};

export function ChatSuggestions({ onSelect }: Props) {
  return (
    <Section className="flex w-full max-w-3xl flex-col items-center">
      <SectionHeader className="text-center">
        <SectionTitle>openstatus assistant</SectionTitle>
        <SectionDescription>
          Ask about your workspace, draft status reports, or schedule
          maintenance windows.
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
  );
}
