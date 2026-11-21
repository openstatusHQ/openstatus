"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/rq-client";

import { type AskAiAgentId, askAiAgents, buildAskAiPrompt } from "./ask-ai";

const PATH = "/";

const cell =
  "flex items-center justify-center px-3 py-2 text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

export function HomeAskAi({ title }: { title?: string }) {
  const { copy, isCopied } = useCopyToClipboard();
  const track = api.track.contentCopied.useMutation();
  const prompt = buildAskAiPrompt({ path: PATH, title });

  const onHandoff = (agent: AskAiAgentId) =>
    track.mutate({ kind: "handoff", path: PATH, agent });

  const onCopy = async () => {
    const ok = await copy(prompt, {
      successMessage: "Prompt copied. Paste it into any AI.",
      withToast: true,
    });
    if (ok) track.mutate({ kind: "prompt", path: PATH });
  };

  return (
    <TooltipProvider>
      <div className="not-prose mb-6 flex w-fit max-w-full divide-x border text-base">
        <span className="text-muted-foreground px-3 py-2">Ask</span>
        {askAiAgents.map(({ id, name, icon: Icon, href }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <a
                href={href(prompt)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ask ${name} about openstatus`}
                onClick={() => onHandoff(id)}
                className={cn(cell, "w-10 px-0")}
              >
                <Icon className="size-3.5" />
              </a>
            </TooltipTrigger>
            <TooltipContent>Ask {name}</TooltipContent>
          </Tooltip>
        ))}
        <button type="button" onClick={onCopy} className={cell}>
          {isCopied ? "[prompt copied]" : "[copy prompt]"}
        </button>
      </div>
    </TooltipProvider>
  );
}
