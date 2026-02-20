import { db, eq } from "@openstatus/db";
import { page, pageComponent } from "@openstatus/db/src/schema";
import { tool } from "ai";
import { z } from "zod";

export function createListStatusPagesTool(workspaceId: number) {
  return tool({
    description:
      "List all status pages for this workspace, including their components. Use this to find which page and components to use when creating a status report.",
    inputSchema: z.object({}),
    execute: async () => {
      const pages = await db
        .select({
          id: page.id,
          title: page.title,
          slug: page.slug,
        })
        .from(page)
        .where(eq(page.workspaceId, workspaceId))
        .all();

      const result = await Promise.all(
        pages.map(async (p) => {
          const components = await db
            .select({
              id: pageComponent.id,
              name: pageComponent.name,
            })
            .from(pageComponent)
            .where(eq(pageComponent.pageId, p.id))
            .all();

          return {
            id: p.id,
            title: p.title,
            slug: p.slug,
            components: components.map((c) => ({
              id: String(c.id),
              name: c.name,
            })),
          };
        }),
      );

      return { pages: result };
    },
  });
}
