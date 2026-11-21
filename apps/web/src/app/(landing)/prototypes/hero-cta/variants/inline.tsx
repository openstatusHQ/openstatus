"use client";

import { cn } from "@/lib/utils";

import {
  cell,
  FreeLine,
  GitHubLink,
  handoffAgents,
  SignupButton,
  useAskPrompt,
  type VariantProps,
} from "../shared";

export function Inline({ title }: VariantProps) {
  const { prompt, onCopy, isCopied } = useAskPrompt(title);
  return (
    <>
      <div className="not-prose my-4 flex flex-wrap items-center gap-2">
        <SignupButton />
        <div className="flex w-fit max-w-full border">
          <span className="text-muted-foreground px-3 py-2 max-sm:hidden">
            Ask
          </span>
          {handoffAgents.map(({ id, name, icon: Icon, href }, i) => (
            <a
              key={id}
              href={href(prompt)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ask ${name} about openstatus`}
              className={cn(
                cell,
                "w-10 border-l px-0",
                i === 0 && "max-sm:border-l-0",
              )}
            >
              <Icon className="size-3.5" />
            </a>
          ))}
          <button
            type="button"
            onClick={onCopy}
            className={cn(cell, "border-l")}
          >
            {isCopied ? "[prompt copied]" : "[copy prompt]"}
          </button>
        </div>
        <GitHubLink />
      </div>
      <FreeLine />
    </>
  );
}
