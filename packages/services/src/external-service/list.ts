import { asc, db as defaultDb, eq, or, sql } from "@openstatus/db";
import {
  type ExternalService,
  apiConfigSchema,
  externalService,
  selectExternalServiceSchema,
} from "@openstatus/db/src/schema";

import { type GlobalReadContext, liveOnlyClause } from "./internal";

export type ListExternalServicesInput = {
  includeDeleted?: boolean;
};

export type ExternalServiceRow = ExternalService;

function parseRow(raw: ExternalService): ExternalService | null {
  if (raw.apiConfig != null) {
    const parsed = apiConfigSchema.safeParse(raw.apiConfig);
    if (!parsed.success) {
      console.warn(
        `[external-service] dropping row id=${raw.id} slug=${raw.slug}: invalid apiConfig`,
        parsed.error.issues,
      );
      return null;
    }
  }
  return raw;
}

function validateRows(rows: ReadonlyArray<unknown>): ExternalServiceRow[] {
  const out: ExternalServiceRow[] = [];
  for (const row of rows) {
    const select = selectExternalServiceSchema.safeParse(row);
    if (!select.success) {
      console.warn(
        "[external-service] dropping row: failed select schema",
        select.error.issues,
      );
      continue;
    }
    const validated = parseRow(select.data);
    if (validated) out.push(validated);
  }
  return out;
}

export async function listExternalServices(args: {
  ctx?: GlobalReadContext;
  input?: ListExternalServicesInput;
}): Promise<ExternalServiceRow[]> {
  const { ctx, input } = args ?? {};
  const db = ctx?.db ?? defaultDb;

  const query = db
    .select()
    .from(externalService)
    .orderBy(asc(sql`lower(${externalService.name})`));

  const rows = input?.includeDeleted
    ? await query.all()
    : await query.where(liveOnlyClause()).all();

  return validateRows(rows);
}

export async function getExternalServiceBySlug(args: {
  ctx?: GlobalReadContext;
  slug: string;
}): Promise<ExternalServiceRow | null> {
  const { ctx, slug } = args;
  const db = ctx?.db ?? defaultDb;

  const rows = await db
    .select()
    .from(externalService)
    .where(
      or(
        eq(externalService.slug, slug),
        sql`EXISTS (SELECT 1 FROM json_each(${externalService.aliases}) WHERE value = ${slug})`,
      ),
    )
    .all();

  const validated = validateRows(rows);
  return validated[0] ?? null;
}
