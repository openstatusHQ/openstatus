"use client";

import {
  FreeLine,
  GitHubLink,
  handoffAgents,
  SignupButton,
  useAskPrompt,
  type VariantProps,
} from "../shared";

export function Tiered({ title }: VariantProps) {
  const { prompt, onCopy, isCopied } = useAskPrompt(title);
  return (
    <>
      <div className="not-prose my-4 flex flex-wrap items-center gap-2">
        <SignupButton />
        <GitHubLink className="border" />
      </div>
      <FreeLine />
      <div className="not-prose text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed pt-3">
        <span>Still deciding? Ask your AI:</span>
        {handoffAgents.map(({ id, name, icon: Icon, href }) => (
          <a
            key={id}
            href={href(prompt)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground flex items-center gap-1.5 underline-offset-4 transition-colors duration-150 ease-out hover:underline"
          >
            <Icon className="size-3.5" />
            {name}
          </a>
        ))}
        <button
          type="button"
          onClick={onCopy}
          className="hover:text-foreground transition-colors duration-150 ease-out"
        >
          {isCopied ? "[prompt copied]" : "[copy prompt]"}
        </button>
      </div>
    </>
  );
}
