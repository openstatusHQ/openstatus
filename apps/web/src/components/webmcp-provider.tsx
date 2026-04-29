"use client";

import { useEffect } from "react";

// WebMCP — expose homepage actions to in-browser AI agents.
// https://webmachinelearning.github.io/webmcp/
// https://developer.chrome.com/blog/webmcp-epp
//
// The API is unstable and only available in browsers shipping the prototype.
// We feature-detect navigator.modelContext and no-op everywhere else.

type JSONSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

type ModelContext = {
  provideContext: (ctx: { tools: WebMcpTool[] }) => void;
};

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

const navigateTo = (path: string) => {
  if (typeof window === "undefined") return { ok: false };
  window.location.assign(path);
  return { ok: true, url: new URL(path, window.location.origin).toString() };
};

const tools: WebMcpTool[] = [
  {
    name: "open_dashboard",
    description:
      "Open the openstatus dashboard (signed-in app). Use when the user wants to log in, sign up, or manage their workspace.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("https://app.openstatus.dev"),
  },
  {
    name: "view_pricing",
    description:
      "Navigate to the openstatus pricing page. Use when the user asks how much openstatus costs or which plan to choose.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("/pricing"),
  },
  {
    name: "open_docs",
    description:
      "Open the openstatus documentation site (docs.openstatus.dev). Use when the user wants reference material, API docs, or how-to guides.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Optional search term to focus the docs landing (e.g. 'mcp', 'cli', 'terraform').",
        },
      },
      additionalProperties: false,
    },
    execute: ({ topic }) => {
      const base = "https://docs.openstatus.dev";
      if (typeof topic === "string" && topic.trim().length > 0) {
        return navigateTo(`${base}?q=${encodeURIComponent(topic.trim())}`);
      }
      return navigateTo(base);
    },
  },
  {
    name: "view_changelog",
    description:
      "Navigate to the openstatus changelog. Use when the user asks about recent updates, releases, or what's new.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("/changelog"),
  },
  {
    name: "view_blog",
    description: "Navigate to the openstatus blog index.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("/blog"),
  },
  {
    name: "view_status",
    description:
      "Open the openstatus public status page so the user can see whether the platform itself is healthy.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("https://status.openstatus.dev"),
  },
  {
    name: "book_call",
    description:
      "Open the calendar to book a call with the openstatus team. Use for sales, demos, or onboarding requests.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("/cal"),
  },
  {
    name: "open_github",
    description:
      "Open the openstatus GitHub repository. Use when the user wants source code, issues, or to self-host.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("/github"),
  },
  {
    name: "open_discord",
    description:
      "Open the openstatus Discord community for support and discussion.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => navigateTo("/discord"),
  },
];

export function WebMcpProvider() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ctx = navigator.modelContext;
    if (!ctx?.provideContext) return;
    try {
      ctx.provideContext({ tools });
    } catch (err) {
      // Spec is in flight — surface the error in dev, swallow in prod.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[webmcp] provideContext failed", err);
      }
    }
  }, []);

  return null;
}
