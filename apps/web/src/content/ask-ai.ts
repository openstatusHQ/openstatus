import {
  ClaudeIcon,
  CursorIcon,
  GeminiIcon,
  OpenAIIcon,
} from "@openstatus/icons/brand";

const BASE = "https://www.openstatus.dev";

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

// Prefill query params are undocumented; Gemini has none, so its link copies the prompt instead.
export const askAiAgents = [
  {
    id: "claude",
    name: "Claude",
    icon: ClaudeIcon,
    prefills: true,
    href: (prompt: string) =>
      `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    icon: OpenAIIcon,
    prefills: true,
    href: (prompt: string) =>
      `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: GeminiIcon,
    prefills: false,
    href: (_prompt: string) => "https://gemini.google.com/app",
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: CursorIcon,
    prefills: true,
    href: (prompt: string) =>
      `https://cursor.com/link/prompt?text=${encodeURIComponent(prompt)}`,
  },
] as const;

export type AskAiAgentId = (typeof askAiAgents)[number]["id"];
