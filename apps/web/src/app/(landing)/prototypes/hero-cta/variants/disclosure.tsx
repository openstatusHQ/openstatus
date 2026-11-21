"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { ChevronDown } from "lucide-react";

import {
  FreeLine,
  GitHubLink,
  handoffAgents,
  SignupButton,
  useAskPrompt,
  type VariantProps,
} from "../shared";

const row =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 ease-out";

export function Disclosure({ title }: VariantProps) {
  const { prompt, onCopy, isCopied } = useAskPrompt(title);
  return (
    <>
      <div className="not-prose my-4 flex flex-wrap items-center gap-2">
        <SignupButton />
        <Popover>
          <PopoverTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground group flex items-center gap-2 border px-3 py-2 transition-colors duration-150 ease-out">
            Ask AI
            <ChevronDown className="size-4 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-56 rounded-none p-0 font-mono text-base shadow-none"
          >
            {handoffAgents.map(({ id, name, icon: Icon, href }) => (
              <a
                key={id}
                href={href(prompt)}
                target="_blank"
                rel="noopener noreferrer"
                className={row}
              >
                <Icon className="size-3.5" />
                Ask {name}
              </a>
            ))}
            <button
              type="button"
              onClick={onCopy}
              className={`${row} border-t`}
            >
              {isCopied ? "[prompt copied]" : "[copy prompt]"}
            </button>
          </PopoverContent>
        </Popover>
        <GitHubLink />
      </div>
      <FreeLine />
    </>
  );
}
