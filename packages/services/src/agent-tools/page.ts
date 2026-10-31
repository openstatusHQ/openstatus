import { slugSchema } from "@openstatus/db/src/schema/pages/validation";
import { z } from "zod";

import { assertCreateBudget } from "../auth";
import { withTransaction } from "../context";
import {
  getPage,
  listPages,
  newPage,
  updatePageGeneral,
  updatePageLinks,
} from "../page";
import type { AgentTool } from "./types";
import { dashboardUrl, statusPageUrl } from "./urls";

const ListStatusPagesInput = z.object({}).strict();
const ListStatusPagesOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      slug: z.string(),
    }),
  ),
});

export const listStatusPagesTool: AgentTool<
  z.infer<typeof ListStatusPagesInput>,
  z.infer<typeof ListStatusPagesOutput>
> = {
  name: "list_status_pages",
  description:
    "List status pages in this workspace with their slug and ids. Use to discover the pageId required by create_status_report and create_maintenance.",
  scope: "pages:read",
  destructive: false,
  inputSchema: ListStatusPagesInput,
  outputSchema: ListStatusPagesOutput,
  async run({ ctx }) {
    const pages = await listPages({ ctx, input: { order: "desc" } });
    return {
      items: pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
    };
  },
};

const CreateStatusPageInputShape = z.object({
  title: z.string().trim().min(1).max(256).describe("Public page title."),
  slug: slugSchema.describe(
    "Subdomain of the public URL (<slug>.openstatus.dev): letters, digits and hyphens, at least 3 characters, unique across openstatus. Confirm it with the user.",
  ),
  description: z
    .string()
    .optional()
    .describe("Short public description shown under the title."),
});

const StatusPageOutput = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  url: z.string(),
  dashboardUrl: z.string(),
});

function toStatusPageOutput(page: {
  id: number;
  slug: string;
  title: string;
}): z.infer<typeof StatusPageOutput> {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    url: statusPageUrl(page.slug),
    dashboardUrl: dashboardUrl(`/status-pages/${page.id}/components`),
  };
}

const CreateStatusPageOutput = StatusPageOutput;

export const createStatusPageTool: AgentTool<
  z.infer<typeof CreateStatusPageInputShape>,
  z.infer<typeof CreateStatusPageOutput>
> = {
  name: "create_status_page",
  description:
    "Create a public status page at https://<slug>.openstatus.dev with no components yet. AUDIT-LOGGED and counts against the plan's status page limit. Fails when the slug is taken. Add monitors to it with add_page_component. Custom domain, password/access control and theme are configured in the dashboard, not here.",
  scope: "pages:write",
  destructive: true,
  inputSchema: CreateStatusPageInputShape,
  outputSchema: CreateStatusPageOutput,
  approval: {
    summarize: (input) => ({
      title: `Create Status Page: ${input.title}`,
      lines: [
        { label: "Title", value: input.title },
        { label: "Slug", value: input.slug },
        ...(input.description
          ? [{ label: "Description", value: input.description }]
          : []),
      ],
    }),
    verb: "created",
  },
  async run({ ctx, input }) {
    await assertCreateBudget(ctx);
    const page = await newPage({
      ctx,
      input: {
        title: input.title,
        slug: input.slug,
        description: input.description,
      },
    });
    return toStatusPageOutput(page);
  },
};

// Omitted keeps the current value; "" clears it.
function merge(
  value: string | undefined,
  current: string | null | undefined,
): string | null {
  if (value === undefined) return current ?? null;
  return value === "" ? null : value;
}

// http(s) only: these render as links and an image src on the public page.
const optionalHttpUrl = z.union([z.literal(""), z.httpUrl()]).optional();

const UpdateStatusPageInputShape = z
  .object({
    pageId: z
      .number()
      .int()
      .describe("Status page id. Resolve via list_status_pages — never guess."),
    title: z.string().trim().min(1).max(256).optional(),
    slug: slugSchema
      .optional()
      .describe(
        "New subdomain (<slug>.openstatus.dev). Changes the public URL; confirm with the user. Fails when taken.",
      ),
    description: z
      .string()
      .optional()
      .describe("Public description under the title. Empty string clears it."),
    icon: optionalHttpUrl
      .describe("Icon image URL. Empty string removes it."),
    homepageUrl: optionalHttpUrl
      .describe("Link back to the product site. Empty string removes it."),
    contactUrl: optionalHttpUrl
      .describe("Support/contact link. Empty string removes it."),
  })
  .refine(
    (input) => Object.values(input).filter((v) => v !== undefined).length > 1,
    { message: "Send at least one field to change besides pageId." },
  );

export const updateStatusPageTool: AgentTool<
  z.infer<typeof UpdateStatusPageInputShape>,
  z.infer<typeof StatusPageOutput>
> = {
  name: "update_status_page",
  description:
    "Change a status page's basics: title, slug, description, icon, homepage and contact links. AUDIT-LOGGED. Call list_status_pages first and send only the fields that change; omitted fields stay as they are. Custom domain, password/access control, theme and locales are configured in the dashboard, not here.",
  scope: "pages:write",
  destructive: true,
  inputSchema: UpdateStatusPageInputShape,
  outputSchema: StatusPageOutput,
  approval: {
    summarize: (input) => ({
      title: `Update Status Page #${input.pageId}`,
      lines: [
        {
          label: "Page ID",
          value: String(input.pageId),
          ref: { kind: "page", pageId: input.pageId },
        },
        ...(input.title !== undefined
          ? [{ label: "Title", value: input.title }]
          : []),
        ...(input.slug !== undefined
          ? [{ label: "Slug", value: input.slug }]
          : []),
        ...(input.description !== undefined
          ? [{ label: "Description", value: input.description || "(cleared)" }]
          : []),
        ...(input.icon !== undefined
          ? [{ label: "Icon", value: input.icon || "(removed)" }]
          : []),
        ...(input.homepageUrl !== undefined
          ? [{ label: "Homepage", value: input.homepageUrl || "(removed)" }]
          : []),
        ...(input.contactUrl !== undefined
          ? [{ label: "Contact", value: input.contactUrl || "(removed)" }]
          : []),
      ],
    }),
    verb: "updated",
  },
  // Scope and audit come from the verbs inside; the transaction only makes them atomic.
  // oxlint-disable-next-line openstatus/services-mutation-guards
  async run({ ctx, input }) {
    const general =
      input.title !== undefined ||
      input.slug !== undefined ||
      input.description !== undefined ||
      input.icon !== undefined;
    const links =
      input.homepageUrl !== undefined || input.contactUrl !== undefined;

    const existing = await withTransaction(ctx, async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const existing = await getPage({
        ctx: txCtx,
        input: { id: input.pageId },
      });
      if (general) {
        await updatePageGeneral({
          ctx: txCtx,
          input: {
            id: existing.id,
            title: input.title ?? existing.title,
            slug: input.slug ?? existing.slug,
            description: merge(input.description, existing.description),
            icon: merge(input.icon, existing.icon),
          },
        });
      }
      if (links) {
        await updatePageLinks({
          ctx: txCtx,
          input: {
            id: existing.id,
            homepageUrl: merge(input.homepageUrl, existing.homepageUrl),
            contactUrl: merge(input.contactUrl, existing.contactUrl),
          },
        });
      }
      return existing;
    });

    return toStatusPageOutput({
      id: existing.id,
      slug: input.slug ?? existing.slug,
      title: input.title ?? existing.title,
    });
  },
};
