import {
  type App,
  type McpUiHostContext,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { VIEW_CALL_META } from "../../src/routes/mcp/view-call";
import type { Locale } from "./format";

/** The host's locale and time zone, filled in as the host reports them. */
export const hostLocale: Locale = {};

function applyHostContext(context: Partial<McpUiHostContext> | undefined) {
  if (!context) return false;
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables)
    applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  if (context.locale) hostLocale.locale = context.locale;
  if (context.timeZone) hostLocale.timeZone = context.timeZone;
  return true;
}

/**
 * Connect to the host and keep theme, style variables, fonts, locale and time
 * zone in step with it. `onChange` runs after each update so the view can
 * re-render. Set `app.ontoolresult` before calling: the result can arrive
 * as soon as the connection is up.
 */
export async function connectHost(app: App, onChange: () => void) {
  applyDocumentTheme(
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  app.onhostcontextchanged = (context) => {
    if (applyHostContext(context)) onChange();
  };
  await app.connect();
  if (applyHostContext(app.getHostContext())) onChange();
}

/** Call one of our own tools from a view, tagged so analytics can tell. */
export async function callTool(
  app: App,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  return app.callServerTool({
    name,
    arguments: args,
    _meta: VIEW_CALL_META,
  });
}

export function resultText(result: CallToolResult): string {
  return result.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
}
