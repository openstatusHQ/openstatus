import { db as defaultDb, eq } from "@openstatus/db";
import { externalServiceComponent } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";
import { assignComponentSlugs } from "./internal";

export type UpsertExternalComponentInput = {
  upstreamComponentId: string;
  name: string;
  description?: string;
  groupName?: string;
  position: number;
  indicator: string;
  status: string;
};

export type UpsertedComponent = {
  id: number;
  upstreamComponentId: string;
};

export type UpsertExternalComponentsResult = {
  upserted: UpsertedComponent[];
};

type ExistingRow = {
  id: number;
  upstreamComponentId: string;
  slug: string;
  aliases: string[];
  name: string;
  description: string | null;
  groupName: string | null;
  position: number;
  indicator: string;
  status: string;
};

type DesiredRow = {
  externalServiceId: number;
  upstreamComponentId: string;
  slug: string;
  aliases: string[];
  name: string;
  description: string | null;
  groupName: string | null;
  position: number;
  indicator: string;
  status: string;
};

function nullish<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function aliasesEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function componentsEqual(existing: ExistingRow, desired: DesiredRow): boolean {
  return (
    existing.slug === desired.slug &&
    existing.name === desired.name &&
    nullish(existing.description) === nullish(desired.description) &&
    nullish(existing.groupName) === nullish(desired.groupName) &&
    existing.position === desired.position &&
    existing.indicator === desired.indicator &&
    existing.status === desired.status &&
    aliasesEqual(existing.aliases, desired.aliases)
  );
}

export async function upsertExternalComponentsForService(args: {
  ctx?: { db?: DB };
  externalServiceId: number;
  components: UpsertExternalComponentInput[];
  now?: Date;
}): Promise<UpsertExternalComponentsResult> {
  const { ctx, externalServiceId, components } = args;
  if (components.length === 0) return { upserted: [] };

  const now = args.now ?? new Date();
  const db = ctx?.db ?? defaultDb;

  // No `withTransaction`/`emitAudit`: external services are a global, public,
  // cron-driven catalogue with no workspace scope or audit log (ADR-0006/0007).
  // `withBusyRetry` wraps the raw transaction since the audit-aware helper
  // expects a workspace ServiceContext.
  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: externalServiceComponent.id,
          upstreamComponentId: externalServiceComponent.upstreamComponentId,
          slug: externalServiceComponent.slug,
          aliases: externalServiceComponent.aliases,
          name: externalServiceComponent.name,
          description: externalServiceComponent.description,
          groupName: externalServiceComponent.groupName,
          position: externalServiceComponent.position,
          indicator: externalServiceComponent.indicator,
          status: externalServiceComponent.status,
        })
        .from(externalServiceComponent)
        .where(
          eq(externalServiceComponent.externalServiceId, externalServiceId),
        )
        .all();

      const existingByUpstream = new Map<string, ExistingRow>(
        existing.map((row) => [row.upstreamComponentId, row]),
      );

      const slugs = assignComponentSlugs({
        existing,
        incoming: components.map((c) => ({
          upstreamComponentId: c.upstreamComponentId,
          name: c.name,
        })),
      });

      const inserts: DesiredRow[] = [];
      const updates: Array<{ id: number; row: DesiredRow }> = [];
      const upserted: UpsertedComponent[] = [];

      for (const c of components) {
        const assigned = slugs.get(c.upstreamComponentId);
        const desired: DesiredRow = {
          externalServiceId,
          upstreamComponentId: c.upstreamComponentId,
          slug: assigned?.slug ?? c.upstreamComponentId,
          aliases: assigned?.aliases ?? [],
          name: c.name,
          description: nullish(c.description),
          groupName: nullish(c.groupName),
          position: c.position,
          indicator: c.indicator,
          status: c.status,
        };

        const prev = existingByUpstream.get(c.upstreamComponentId);
        if (!prev) {
          inserts.push(desired);
          continue;
        }
        // skipped components still surface their existing id so the cron's TB
        // publish can emit a snapshot for them every tick.
        upserted.push({
          id: prev.id,
          upstreamComponentId: prev.upstreamComponentId,
        });
        if (!componentsEqual(prev, desired)) {
          updates.push({ id: prev.id, row: desired });
        }
      }

      if (inserts.length > 0) {
        const insertedRows = await tx
          .insert(externalServiceComponent)
          .values(
            inserts.map((row) => ({
              ...row,
              firstSeenAt: now,
              updatedAt: now,
            })),
          )
          .returning({
            id: externalServiceComponent.id,
            upstreamComponentId: externalServiceComponent.upstreamComponentId,
          })
          .all();
        for (const row of insertedRows) upserted.push(row);
      }

      for (const { id, row } of updates) {
        await tx
          .update(externalServiceComponent)
          .set({
            slug: row.slug,
            aliases: row.aliases,
            name: row.name,
            description: row.description,
            groupName: row.groupName,
            position: row.position,
            indicator: row.indicator,
            status: row.status,
            updatedAt: now,
          })
          .where(eq(externalServiceComponent.id, id))
          .run();
      }

      return { upserted };
    }),
  );
}
