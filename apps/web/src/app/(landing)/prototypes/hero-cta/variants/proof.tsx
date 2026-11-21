"use client";

import { cn } from "@/lib/utils";

import {
  cell,
  GITHUB_HREF,
  handoffAgents,
  SignupButton,
  STARS,
  useAskPrompt,
  type VariantProps,
} from "../shared";

export function Proof({ title }: VariantProps) {
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
      </div>
      <p className="text-muted-foreground">
        Free to start. Open source, AGPL-3.0, with{" "}
        <a
          href={GITHUB_HREF}
          className="text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          {STARS} stars on GitHub
        </a>
        . Paid plans from $30/mo.
      </p>
    </>
  );
}
