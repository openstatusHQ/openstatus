import { eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { z } from "zod";

import { type PublicServiceContext, getReadDb } from "../context";
import { Status, derivePageStatus } from "./derive-status";

const CurrentStatusInput = z.object({ slug: z.string() });

export type CurrentStatusInput = z.input<typeof CurrentStatusInput>;

/**
 * Current status of a public status page. Returns `Status.Unknown` when the
 * page does not exist or is not publicly accessible.
 */
export async function currentStatus(args: {
  ctx: PublicServiceContext;
  input: CurrentStatusInput;
}): Promise<Status> {
  const { slug } = CurrentStatusInput.parse(args.input);
  const db = getReadDb(args.ctx);

  const currentPage = await db.query.page.findFirst({
    where: eq(page.slug, slug),
    with: {
      pageComponents: {
        with: { monitor: { with: { incidents: true } } },
      },
      statusReports: true,
      maintenances: true,
    },
  });

  if (!currentPage || currentPage.accessType !== "public") {
    return Status.Unknown;
  }

  const incidents = currentPage.pageComponents.flatMap((c) =>
    c.type === "monitor" && c.monitor?.active && !c.monitor.deletedAt
      ? c.monitor.incidents
      : [],
  );

  return derivePageStatus({
    maintenances: currentPage.maintenances,
    statusReports: currentPage.statusReports,
    incidents,
  });
}
