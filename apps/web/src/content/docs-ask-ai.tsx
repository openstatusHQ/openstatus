"use client";

import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { usePathname } from "next/navigation";

import { api } from "@/trpc/rq-client";

import { askAiAgents, buildAskAiPrompt } from "./ask-ai";

export function DocsAskAi({ title }: { title?: string }) {
  const pathname = usePathname();
  const { copy, isCopied } = useCopyToClipboard();
  const track = api.track.contentCopied.useMutation();

  const onCopy = async () => {
    const ok = await copy(buildAskAiPrompt({ path: pathname, title }), {
      successMessage: "Prompt copied to clipboard",
      withToast: true,
    });
    if (ok) track.mutate({ kind: "prompt", path: pathname });
  };

  return (
    <div className="text-sm">
      <p className="text-foreground py-2 font-mono font-medium">
        Have a question?
      </p>
      <button
        type="button"
        onClick={onCopy}
        className="bg-background text-muted-foreground hover:bg-muted hover:text-foreground flex w-full gap-2 border px-1 py-2 font-mono whitespace-nowrap transition-colors"
      >
        <span className="flex items-center" aria-hidden="true">
          {askAiAgents.map(({ name, icon: Icon }) => (
            <span
              key={name}
              className="bg-background -ml-2 flex size-5 items-center justify-center border first:ml-0"
            >
              <Icon className="size-3" />
            </span>
          ))}
        </span>
        {isCopied ? "Prompt copied" : "Copy prompt for AI"}
      </button>
    </div>
  );
}
