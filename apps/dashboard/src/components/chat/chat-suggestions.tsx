import { Button } from "@openstatus/ui/components/ui/button";

const SUGGESTIONS = [
  "Show me my status pages",
  "What status reports are open?",
  "Draft a status report",
  "Schedule a maintenance window",
  "List all the openstatus tools to be used",
];

type Props = {
  onSelect: (text: string) => void;
};

export function ChatSuggestions({ onSelect }: Props) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="font-medium text-foreground text-lg">
          openstatus assistant
        </h2>
        <p className="font-commit-mono text-muted-foreground text-sm">
          Ask about your workspace, draft status reports, or schedule
          maintenance windows.
        </p>
      </div>
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
    </div>
  );
}
