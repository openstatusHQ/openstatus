import { selectPageSchema } from "@openstatus/db/src/schema";

import { dbOnlyContext, type DB, getReadDb } from "../context";
import type { Page } from "../types";
import { findPageBySlug } from "./internal";
import { PublicPageInput } from "./schemas";

/**
 * The page a host or slug resolves to, unfiltered and ungated: callers apply
 * `accessType` and `allowIndex` themselves. `null` when none matches or the
 * stored row no longer parses.
 */
export async function getPublicStatusPageRow(args: {
  input: PublicPageInput;
  db?: DB;
}): Promise<Page | null> {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));
  const parsed = selectPageSchema.safeParse(
    await findPageBySlug(db, input.slug),
  );
  return parsed.success ? parsed.data : null;
}
