import { db as defaultDb, eq, sql } from "@openstatus/db";
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
  // cron-driven catalogue with no workspace scope or audit log (ADR-0006/0007),
  // mirroring `upsertExternalIncidentsForService`. `withBusyRetry` wraps the raw
  // transaction since the audit-aware helper expects a workspace ServiceContext.
  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      const existing = await tx
        .select({
          upstreamComponentId: externalServiceComponent.upstreamComponentId,
          name: externalServiceComponent.name,
          slug: externalServiceComponent.slug,
          aliases: externalServiceComponent.aliases,
        })
        .from(externalServiceComponent)
        .where(
          eq(externalServiceComponent.externalServiceId, externalServiceId),
        )
        .all();

      const slugs = assignComponentSlugs({
        existing,
        incoming: components.map((c) => ({
          upstreamComponentId: c.upstreamComponentId,
          name: c.name,
        })),
      });

      const values = components.map((c) => {
        const assigned = slugs.get(c.upstreamComponentId);
        return {
          externalServiceId,
          upstreamComponentId: c.upstreamComponentId,
          slug: assigned?.slug ?? c.upstreamComponentId,
          aliases: assigned?.aliases ?? [],
          name: c.name,
          description: c.description,
          groupName: c.groupName,
          position: c.position,
          indicator: c.indicator,
          status: c.status,
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
        };
      });

      const rows = await tx
        .insert(externalServiceComponent)
        .values(values)
        .onConflictDoUpdate({
          target: [
            externalServiceComponent.externalServiceId,
            externalServiceComponent.upstreamComponentId,
          ],
          set: {
            slug: sql`excluded.slug`,
            aliases: sql`excluded.aliases`,
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            groupName: sql`excluded.group_name`,
            position: sql`excluded.position`,
            indicator: sql`excluded.indicator`,
            status: sql`excluded.status`,
            lastSeenAt: now,
            updatedAt: now,
          },
        })
        .returning({
          id: externalServiceComponent.id,
          upstreamComponentId: externalServiceComponent.upstreamComponentId,
        })
        .all();
      return { upserted: rows };
    }),
  );
}
