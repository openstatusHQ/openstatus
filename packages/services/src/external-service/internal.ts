import { eq, isNull, or, sql } from "@openstatus/db";
import { externalService } from "@openstatus/db/src/schema";

import { type DB, defaultTb } from "../context";
import { ConflictError } from "../errors";

export type ExternalComponentLatestRow = {
  component_id: string;
  indicator: string;
  status: string;
  last_fetched_at: number;
};

// Narrow surface of `OSTinybird` used by external-service reads. Tests can pass
// a stub that implements just this method without instantiating an OSTinybird.
export type ExternalComponentLatestReader = {
  externalStatusComponentLatest: (args: {
    component_ids: string[];
  }) => Promise<{ data: ExternalComponentLatestRow[] }>;
};

export type GlobalReadContext = {
  db?: DB;
  tb?: ExternalComponentLatestReader;
};

export function getReadTb(
  ctx: GlobalReadContext | undefined,
): ExternalComponentLatestReader {
  return ctx?.tb ?? defaultTb;
}

export async function assertSlugAvailable(args: {
  tx: DB;
  slug: string;
  exceptServiceId?: number;
}): Promise<void> {
  const { tx, slug, exceptServiceId } = args;
  const rows = await tx
    .select({ id: externalService.id })
    .from(externalService)
    .where(
      or(
        eq(externalService.slug, slug),
        sql`EXISTS (SELECT 1 FROM json_each(${externalService.aliases}) WHERE value = ${slug})`,
      ),
    )
    .all();
  const conflicts = exceptServiceId
    ? rows.filter((r) => r.id !== exceptServiceId)
    : rows;
  if (conflicts.length > 0) {
    throw new ConflictError(`slug "${slug}" is already in use`);
  }
}

export function liveOnlyClause() {
  return isNull(externalService.deletedAt);
}
