"use client";

import { GitHubIcon } from "@openstatus/icons/brand";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import type React from "react";

import { buildAskAiPrompt, handoffAgents } from "@/content/ask-ai";
import { cn } from "@/lib/utils";

export type VariantProps = { title: string };

export const GITHUB_HREF = "https://openstatus.dev/github";
export const SIGNUP_HREF = "https://app.openstatus.dev";
export const STARS = "9k+";

export const cell =
  "flex items-center justify-center px-3 py-2 text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

export { handoffAgents };

export function useAskPrompt(title: string) {
  const { copy, isCopied } = useCopyToClipboard();
  const prompt = buildAskAiPrompt({ path: "/", title });
  const onCopy = () =>
    copy(prompt, {
      successMessage: "Prompt copied. Paste it into any AI.",
      withToast: true,
    });
  return { prompt, onCopy, isCopied };
}

export function SignupButton({ className }: { className?: string }) {
  return (
    <a
      href={SIGNUP_HREF}
      className={cn(
        "bg-foreground text-background flex items-center px-3 py-2 transition-[opacity,scale] duration-150 ease-out hover:opacity-90 active:scale-[0.97]",
        className,
      )}
    >
      Get started free
    </a>
  );
}

export function GitHubLink({
  className,
  children = STARS,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={GITHUB_HREF}
      className={cn(
        "text-muted-foreground hover:text-foreground flex items-center gap-2 px-3 py-2 transition-colors duration-150 ease-out",
        className,
      )}
    >
      <GitHubIcon className="size-5" />
      {children}
    </a>
  );
}

export function FreeLine({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-muted-foreground">
      Free to start. Try Starter free for 14 days, no card needed. Paid plans
      from $30/mo.{children}
    </p>
  );
}
