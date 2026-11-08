"use client";

import { ClaudeIcon, CursorIcon, OpenAIIcon } from "@openstatus/icons/brand";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { usePathname } from "next/navigation";

import { api } from "@/trpc/rq-client";

const BASE = "https://www.openstatus.dev";

const agents = [
  { name: "Claude", icon: ClaudeIcon },
  { name: "OpenAI", icon: OpenAIIcon },
  { name: "Cursor", icon: CursorIcon },
];

export function buildAskAiPrompt({
  path,
  title,
}: {
  path: string;
  title?: string;
}) {
  const page = path.replace(/^\//, "");
  return `I have questions about openstatus, the open-source uptime monitoring and status page platform. Answer from the official openstatus docs, not from memory.

I'm currently reading${title ? ` "${title}"` : ""}: ${BASE}/${page}
The same page as markdown: ${BASE}/api/markdown/${page}

Where to find things:
- Index of every docs page, guide and changelog entry: ${BASE}/llms.txt
- All docs in a single file: ${BASE}/llms-full.txt
- Any page as markdown: ${BASE}/api/markdown/<path>, e.g. ${BASE}/api/markdown/docs/reference/http-monitor
- Search: ${BASE}/api/search?p=docs&q=<query> (p is docs, guides or changelog)
- If you are connected to the openstatus MCP server (https://api.openstatus.dev/mcp), use its search_docs and get_doc_page tools instead.

Link the pages you used in every answer. If the docs don't cover something, say so.

My question: `;
}

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
        className="bg-background text-muted-foreground hover:bg-muted hover:text-foreground flex w-full gap-2 border px-1 py-2 font-mono transition-colors"
      >
        <span className="flex items-center" aria-hidden="true">
          {agents.map(({ name, icon: Icon }) => (
            <span
              key={name}
              className="bg-background -ml-1.5 flex size-5 items-center justify-center border first:ml-0"
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
