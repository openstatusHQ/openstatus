import { db as defaultDb } from "@openstatus/db";
import { externalService } from "@openstatus/db/src/schema";

import { retryRead } from "../retry";
import { type GlobalReadContext, liveOnlyClause } from "./internal";

export type SlugMap = {
  canonical: string[];
  aliases: Array<{ from: string; to: string }>;
};

export async function listExternalServiceSlugs(args?: {
  ctx?: GlobalReadContext;
  includeDeleted?: boolean;
}): Promise<SlugMap> {
  const { ctx, includeDeleted } = args ?? {};
  const db = ctx?.db ?? defaultDb;

  const query = db
    .select({
      slug: externalService.slug,
      aliases: externalService.aliases,
    })
    .from(externalService);

  const rows = await retryRead(() =>
    includeDeleted ? query.all() : query.where(liveOnlyClause()).all(),
  );

  const canonical: string[] = [];
  const aliases: Array<{ from: string; to: string }> = [];
  for (const row of rows) {
    canonical.push(row.slug);
    const list = (row.aliases ?? []) as string[];
    for (const alias of list) {
      aliases.push({ from: alias, to: row.slug });
    }
  }
  return { canonical, aliases };
}
