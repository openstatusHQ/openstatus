const DOCS = "https://www.openstatus.dev";
const MCP = "https://api.openstatus.dev/mcp";
const PRODUCT =
  "openstatus, the open-source uptime monitoring, status page and incident management platform";

export const AGENT_PROMPTS = {
  setup: `Help me set up ${PRODUCT}. I already have an account and a workspace. Work from the official openstatus docs, not from memory.

1. Connect
Add the openstatus MCP server at ${MCP} (Streamable HTTP, OAuth sign-in in the browser, no key to copy). Per-agent setup for Claude Code, Codex, Cursor, opencode, Claude Desktop and ChatGPT: ${DOCS}/docs/guides/how-to-connect-openstatus-to-your-agent.md
If you can't open a browser, ask me for an API key from https://app.openstatus.dev/settings/general#api-keys and send it as the x-openstatus-key header. Never guess a key.
If you can't use MCP at all, use the openstatus CLI with the same key (OPENSTATUS_API_TOKEN). Install: ${DOCS}/docs/tutorial/get-started-with-openstatus-cli.md Commands: ${DOCS}/docs/reference/cli-reference.md

2. Look around
Call get_workspace, list_monitors, list_status_pages and list_notifications to see what already exists. If you are inside a codebase, find what is worth monitoring: health endpoints, public APIs, the website.

3. Propose, then build
Suggest the monitors (create_monitor), a status page (create_status_page) and its components (add_page_component). Show me the plan and wait for my go before you create or change anything.

Where to find things:
- Index of every docs page, guide and changelog entry: ${DOCS}/llms.txt
- Any page as markdown: add .md to its URL, e.g. ${DOCS}/docs/reference/mcp-server.md
- With the MCP server connected, use its search_docs and get_doc_page tools instead.
`,
  ask: `I have a question about ${PRODUCT}. Answer from the official openstatus docs, not from memory.

Where to find things:
- Index of every docs page, guide and changelog entry: ${DOCS}/llms.txt
- All docs in a single file: ${DOCS}/llms-full.txt
- Any page as markdown: add .md to its URL, e.g. ${DOCS}/docs/reference/http-monitor.md
- Search: ${DOCS}/api/search?p=docs&q=<query> (p is docs, guides or changelog)
- If you are connected to the openstatus MCP server (${MCP}), use its search_docs and get_doc_page tools instead, and its list_* and get_* tools to look at my workspace.

Link the pages you used in every answer. If the docs don't cover something, say so.

My question: `,
};
