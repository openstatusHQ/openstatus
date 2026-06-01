import { db as defaultDb, sql } from "@openstatus/db";
import { externalServiceComponent } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";

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

  const values = components.map((c) => ({
    externalServiceId,
    upstreamComponentId: c.upstreamComponentId,
    name: c.name,
    description: c.description,
    groupName: c.groupName,
    position: c.position,
    indicator: c.indicator,
    status: c.status,
    firstSeenAt: now,
    lastSeenAt: now,
    updatedAt: now,
  }));

  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      const rows = await tx
        .insert(externalServiceComponent)
        .values(values)
        .onConflictDoUpdate({
          target: [
            externalServiceComponent.externalServiceId,
            externalServiceComponent.upstreamComponentId,
          ],
          set: {
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
