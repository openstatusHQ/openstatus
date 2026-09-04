const BASE = "https://www.openstatus.dev";

/** Machine-readable entry points an agent can retry against after a dead link. */
export const AGENT_RECOVERY_LINKS = [
  ["Sitemap", "/sitemap.xml"],
  ["llms.txt", "/llms.txt"],
  ["Documentation", "/docs"],
  ["OpenAPI specification", "/openapi.json"],
  ["MCP server card", "/.well-known/mcp.json"],
] as const;

/**
 * Body for a path that does not exist. Markdown rather than an app shell, so a
 * crawler that hits a dead link can find its way back instead of re-crawling.
 */
export function notFoundMarkdown(pathname: string): string {
  const links = AGENT_RECOVERY_LINKS.map(
    ([title, href]) => `- [${title}](${BASE}${href})`,
  ).join("\n");
  // The path is attacker-chosen and lands in a code span an agent reads:
  // percent-encoding keeps a backtick or newline from closing it and injecting
  // markdown of its own. `encodeURI` leaves `/` readable.
  return `# 404 — Not Found

No page exists at \`${encodeURI(pathname)}\` on openstatus.dev.

## Where to look next

${links}

Every page is also available as markdown: append \`.md\` to the URL or send
\`Accept: text/markdown\`.
`;
}
