import { z } from "zod";

import {
  getExternalServiceStatus,
  listActiveExternalIssues,
} from "../external-service-status";
import type { AgentTool } from "./types";

const STATUS = z.enum([
  "operational",
  "minor_issue",
  "partial_outage",
  "major_outage",
  "maintenance",
  "unknown",
]);

const Incident = z.object({
  title: z.string(),
  status: z.string(),
  impact: z.string().nullable(),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
  url: z.string(),
});

const GetServiceStatusInput = z
  .object({
    service: z
      .string()
      .min(1)
      .describe("Service name, slug or alias, e.g. GitHub, aws, Anthropic"),
    component: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional component of that service, e.g. Actions, Grok Bot, us-east-1",
      ),
  })
  .strict();

const GetServiceStatusOutput = z.object({
  found: z.boolean(),
  verdict: z.string(),
  reportsProblem: z.boolean(),
  status: STATUS,
  escalatedByUserReports: z.boolean(),
  checkedAt: z.string().nullable(),
  stale: z.boolean(),
  providerMessage: z.string().nullable(),
  userReportsLast15Minutes: z.number(),
  service: z
    .object({
      name: z.string(),
      slug: z.string(),
      website: z.string(),
      officialStatusPage: z.string(),
      url: z.string(),
      markdownUrl: z.string(),
    })
    .nullable(),
  component: z
    .object({ name: z.string(), group: z.string().nullable(), url: z.string() })
    .nullable(),
  affectedComponents: z.array(
    z.object({
      name: z.string(),
      group: z.string().nullable(),
      status: STATUS,
      url: z.string(),
    }),
  ),
  affectedComponentCount: z.number(),
  activeIncidents: z.array(Incident),
  recentIncidents: z.array(Incident),
  suggestions: z.array(z.object({ name: z.string(), slug: z.string() })),
});

type GetServiceStatusIn = z.infer<typeof GetServiceStatusInput>;
type GetServiceStatusOut = z.infer<typeof GetServiceStatusOutput>;

export function runGetServiceStatus(
  input: GetServiceStatusIn,
): Promise<GetServiceStatusOut> {
  return getExternalServiceStatus(input);
}

export const getServiceStatusTool: AgentTool<
  GetServiceStatusIn,
  GetServiceStatusOut
> = {
  name: "get_service_status",
  description:
    "Check whether a third-party service (cloud, AI, SaaS, dev tools; 3,000+ tracked) is down right now: a one-line verdict, a reportsProblem flag, affected components, open and recent incidents, and user reports from openstatus.dev, read from the provider's official status page every few minutes. Pass component to narrow to one part of the service. An unknown name returns suggestions. Call it when a request to a provider fails, before changing code.",
  scope: "any",
  destructive: false,
  inputSchema: GetServiceStatusInput,
  outputSchema: GetServiceStatusOutput,
  run: ({ input }) => runGetServiceStatus(input),
};

const ListActiveIssuesInput = z
  .object({
    services: z
      .array(z.string().min(1))
      .max(50)
      .optional()
      .describe(
        "Only these services (names, slugs or aliases), e.g. a project's dependencies. Omit for every tracked service.",
      ),
    minImpact: z
      .enum(["minor_issue", "partial_outage", "major_outage"])
      .optional()
      .describe("Minimum impact to include; default minor_issue"),
    includeMaintenance: z.boolean().default(false),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const ListActiveIssuesOutput = z.object({
  total: z.number(),
  issues: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      status: STATUS,
      escalatedByUserReports: z.boolean(),
      providerMessage: z.string().nullable(),
      openIncident: z
        .string()
        .nullable()
        .describe("Title of the newest open incident, if any"),
      url: z.string(),
    }),
  ),
  unknown: z.array(z.string()),
});

type ListActiveIssuesIn = z.infer<typeof ListActiveIssuesInput>;
type ListActiveIssuesOut = z.infer<typeof ListActiveIssuesOutput>;

export function runListActiveIssues(
  input: ListActiveIssuesIn,
): Promise<ListActiveIssuesOut> {
  return listActiveExternalIssues(input);
}

export const listActiveIssuesTool: AgentTool<
  ListActiveIssuesIn,
  ListActiveIssuesOut
> = {
  name: "list_active_issues",
  description:
    "List third-party services that report a problem right now, worst first, from the 3,000+ services openstatus.dev tracks. Narrow with services (e.g. the providers a project depends on) and minImpact. Names it cannot match come back in unknown.",
  scope: "any",
  destructive: false,
  inputSchema: ListActiveIssuesInput,
  outputSchema: ListActiveIssuesOutput,
  run: ({ input }) => runListActiveIssues(input),
};
