"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/rq-client";

import { type AskAiAgentId, askAiAgents, buildAskAiPrompt } from "./ask-ai";

const ROTATE_MS = 2400;
const PATH = "/";

const cell =
  "flex items-center justify-center transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

export function HomeAskAi({ title }: { title?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { copy, isCopied } = useCopyToClipboard();
  const track = api.track.contentCopied.useMutation();

  const prompt = buildAskAiPrompt({ path: PATH, title });
  const active = askAiAgents[index];

  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % askAiAgents.length),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

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
      <div
        className="not-prose mb-6 flex w-fit max-w-full items-stretch border text-base"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
        }}
      >
        <a
          href={active.href(prompt)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ask ${active.name} about openstatus`}
          onClick={() => onHandoff(active.id)}
          className={cn(cell, "group gap-2 px-3 py-2")}
        >
          <span className="text-muted-foreground">Ask</span>
          <span className="grid overflow-hidden" aria-hidden="true">
            {askAiAgents.map(({ id, name, icon: Icon }, i) => {
              const offset =
                (i - index + askAiAgents.length) % askAiAgents.length;
              return (
                <span
                  key={id}
                  className={cn(
                    "col-start-1 row-start-1 flex items-center gap-1.5 font-semibold transition-[translate,opacity] duration-250 ease-out motion-reduce:transition-none",
                    offset === 0 && "translate-y-0 opacity-100",
                    offset === 1 && "translate-y-full opacity-0",
                    offset > 1 && "-translate-y-full opacity-0",
                  )}
                >
                  <Icon className="size-3.5" />
                  {name}
                </span>
              );
            })}
          </span>
          <span className="max-sm:hidden">about openstatus</span>
          <span
            className="text-muted-foreground transition-[translate] duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          >
            →
          </span>
        </a>
        <div className="flex border-l" role="group" aria-label="Ask AI">
          {askAiAgents.map(({ id, name, icon: Icon }, i) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <a
                  href={askAiAgents[i].href(prompt)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ask ${name} about openstatus`}
                  onPointerEnter={() => setIndex(i)}
                  onFocus={() => setIndex(i)}
                  onClick={() => onHandoff(id)}
                  className={cn(
                    cell,
                    "text-muted-foreground hover:text-foreground w-10",
                    i === index && "bg-muted text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Ask {name}</TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy prompt for any AI"
                className={cn(
                  cell,
                  "text-muted-foreground hover:text-foreground w-10 border-l border-dashed",
                )}
              >
                {isCopied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isCopied ? "Prompt copied" : "Copy prompt for any AI"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
