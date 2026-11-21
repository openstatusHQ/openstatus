import {
  type App,
  type McpUiHostCapabilities,
  type McpUiHostContext,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ChartLocale } from "@openstatus/ui/lib/chart-latency";
import { useEffect, useState } from "react";

import { VIEW_CALL_META } from "../../src/routes/mcp/view-call";

// @openstatus/ui themes with a `.dark` class; ext-apps only sets `data-theme`.
function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

applyTheme(
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
);

export type HostState = {
  /** null until connected. */
  app: App | null;
  error: Error | null;
  /** The latest tool result the host pushed, or `"cancelled"`. */
  result: CallToolResult | "cancelled" | null;
  capabilities: McpUiHostCapabilities | undefined;
  locale: ChartLocale;
};

/**
 * Connect to the host and track what a view needs from it: the pushed tool
 * result, theme, style variables, fonts, locale and time zone.
 */
export function useHost(name: string): HostState {
  const [result, setResult] = useState<HostState["result"]>(null);
  const [locale, setLocale] = useState<ChartLocale>({});

  const applyContext = (context: Partial<McpUiHostContext> | undefined) => {
    if (!context) return;
    if (context.theme) applyTheme(context.theme);
    if (context.styles?.variables)
      applyHostStyleVariables(context.styles.variables);
    if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
    if (context.locale || context.timeZone) {
      setLocale((current) => ({
        locale: context.locale ?? current.locale,
        timeZone: context.timeZone ?? current.timeZone,
      }));
    }
  };

  const { app, error } = useApp({
    appInfo: { name, version: "0.2.0" },
    capabilities: {},
    onAppCreated: (created) => {
      created.ontoolresult = (next) => setResult(next as CallToolResult);
      created.ontoolcancelled = () => setResult("cancelled");
      created.onhostcontextchanged = applyContext;
    },
  });

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per connection
  useEffect(() => applyContext(app?.getHostContext()), [app]);

  return {
    app,
    error,
    result,
    capabilities: app?.getHostCapabilities(),
    locale,
  };
}

/** Call one of our own tools from a view, tagged so analytics can tell. */
export function callTool(
  app: App,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  return app.callServerTool({ name, arguments: args, _meta: VIEW_CALL_META });
}

export function resultText(result: CallToolResult): string {
  return result.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
}
