"use client";

import { cn } from "@/lib/utils";

import {
  cell,
  FreeLine,
  GitHubLink,
  handoffAgents,
  SignupButton,
  STARS,
  useAskPrompt,
  type VariantProps,
} from "../shared";

export function Segmented({ title }: VariantProps) {
  const { prompt, onCopy, isCopied } = useAskPrompt(title);
  return (
    <>
      <div className="not-prose my-4 flex w-fit max-w-full border">
        <SignupButton className="-m-px" />
        {handoffAgents.map(({ id, name, icon: Icon, href }) => (
          <a
            key={id}
            href={href(prompt)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ask ${name} about openstatus`}
            className={cn(cell, "w-10 border-r px-0 first-of-type:border-l-0")}
          >
            <Icon className="size-3.5" />
          </a>
        ))}
        <button
          type="button"
          onClick={onCopy}
          className={cn(cell, "border-r max-sm:hidden")}
        >
          {isCopied ? "[copied]" : "[prompt]"}
        </button>
        <GitHubLink className="hover:bg-muted">
          <span className="max-sm:sr-only">{STARS}</span>
        </GitHubLink>
      </div>
      <FreeLine />
    </>
  );
}
