import { z } from "zod";

import { getWorkspaceUsage } from "../workspace";
import type { AgentTool } from "./types";

const GetWorkspaceInput = z.object({}).strict();
const GetWorkspaceOutput = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string().nullable(),
  plan: z.string(),
  trialEndsAt: z.string().nullable(),
  usage: z.object({
    monitors: z.number().int(),
    statusPages: z.number().int(),
    pageComponents: z.number().int(),
    notificationChannels: z.number().int(),
    statusReports: z.number().int(),
  }),
});

export const getWorkspaceTool: AgentTool<
  z.infer<typeof GetWorkspaceInput>,
  z.infer<typeof GetWorkspaceOutput>
> = {
  name: "get_workspace",
  description:
    "The current workspace: name, slug, plan, trial end and usage counts for monitors, status pages, components, notification channels and status reports. Use to answer which-plan or how-many questions. Plan limits and billing identifiers are NOT exposed.",
  scope: "any",
  destructive: false,
  inputSchema: GetWorkspaceInput,
  outputSchema: GetWorkspaceOutput,
  async run({ ctx }) {
    const { workspace } = ctx;
    const usage = await getWorkspaceUsage({ ctx });
    return {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name ?? null,
      plan: workspace.plan ?? "free",
      trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
      usage: {
        monitors: usage.monitors,
        statusPages: usage.pages,
        pageComponents: usage.pageComponents,
        notificationChannels: usage.notifications,
        statusReports: usage.statusReports,
      },
    };
  },
};
