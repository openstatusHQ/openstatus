import { page } from "@openstatus/db/src/schema";

import { dbOnlyContext, type DB, getReadDb } from "../context";
import { bySlugOrDomain } from "./internal";
import { PublicPageInput } from "./schemas";

export type PublicStatusPageIndexing = Pick<
  typeof page.$inferSelect,
  "slug" | "customDomain" | "accessType" | "allowIndex"
>;

/** What crawler and discovery routes decide on, without the gate secrets. */
export async function getPublicStatusPageIndexing(args: {
  input: PublicPageInput;
  db?: DB;
}): Promise<PublicStatusPageIndexing | null> {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));
  const row = await db
    .select({
      slug: page.slug,
      customDomain: page.customDomain,
      accessType: page.accessType,
      allowIndex: page.allowIndex,
    })
    .from(page)
    .where(bySlugOrDomain(input.slug))
    .get();
  return row ?? null;
}
