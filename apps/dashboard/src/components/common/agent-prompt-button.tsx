"use client";

import { Check, Copy } from "@openstatus/icons";
import { ClaudeIcon, CursorIcon, OpenAIIcon } from "@openstatus/icons/brand";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";

import {
  type AgentPromptSource,
  useCopyAgentPrompt,
} from "@/hooks/use-copy-agent-prompt";

const agents = [
  { name: "Claude", icon: ClaudeIcon },
  { name: "OpenAI", icon: OpenAIIcon },
  { name: "Cursor", icon: CursorIcon },
];

export function AgentPromptButton({
  source,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  source: AgentPromptSource;
}) {
  const { copyPrompt, isCopied } = useCopyAgentPrompt("setup", source);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-slot="agent-prompt-button"
      className={cn("gap-2", className)}
      onClick={copyPrompt}
      {...props}
    >
      <span className="flex items-center" aria-hidden="true">
        {agents.map(({ name, icon: Icon }) => (
          <span
            key={name}
            className="bg-background -ml-1.5 flex size-5 items-center justify-center rounded-full border first:ml-0"
          >
            <Icon className="size-3" />
          </span>
        ))}
      </span>
      {children}
      {isCopied ? (
        <Check className="text-muted-foreground ml-auto" />
      ) : (
        <Copy className="text-muted-foreground ml-auto" />
      )}
    </Button>
  );
}
