import { FIRING_GROUP } from "@openstatus/alert-adapters/providers/alertmanager/fixtures";
import { FIRING_RULE } from "@openstatus/alert-adapters/providers/grafana/fixtures";
import { db, eq } from "@openstatus/db";
import { alertSource, incidentTable } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { drainOnce } from "../inbox/drain";
import { sweepOnce } from "../inbox/sweep";
import { app } from "../index";
import {
  cleanupIngestFixture,
  createIngestFixture,
  drainUntilIdle,
  type IngestFixture,
  inboxRowsFor,
  incidentsFor,
  sourceIdsFor,
  webhookRequest,
} from "./helpers";

let free: IngestFixture;
let team: IngestFixture;

beforeAll(async () => {
  free = await createIngestFixture(["write"], "free");
  team = await createIngestFixture(["write"], "team");
});

afterAll(async () => {
  await cleanupIngestFixture(free);
  await cleanupIngestFixture(team);
});

describe("plan limit", () => {
  test("a second provider past the limit is kept, not dropped", async () => {
    const first = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: free.token,
        body: { ...FIRING_GROUP, groupKey: "limit-1" },
      }),
    );
    expect(first.status).toBe(202);

    const second = await app.request(
      webhookRequest({
        provider: "grafana",
        token: free.token,
        body: FIRING_RULE,
      }),
    );
    expect(second.status).toBe(202);

    const rows = await inboxRowsFor(free.workspaceId);
    const ignored = rows.filter((r) => r.outcome === "ignored");
    expect(ignored.length).toBeGreaterThan(0);
    expect(ignored[0].lastError).toContain("alert-sources");
    // Nothing is lost — the payload is still there for a later upgrade.
    expect(ignored[0].rawBody.length).toBeGreaterThan(0);

    await drainUntilIdle(drainOnce, await sourceIdsFor(free.workspaceId));
    const incidents = await incidentsFor(free.workspaceId);
    const fromGrafana = incidents.filter((i) => i.origin === "external");
    expect(fromGrafana.length).toBeLessThanOrEqual(1);
  });
});

describe("staleness sweep", () => {
  test("an incident with no re-fire past its window auto-resolves", async () => {
    await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: team.token,
        body: { ...FIRING_GROUP, groupKey: `stale-${Date.now()}` },
      }),
    );
    await drainUntilIdle(drainOnce, await sourceIdsFor(team.workspaceId));

    const open = (await incidentsFor(team.workspaceId)).filter(
      (i) => i.resolvedAt === null,
    );
    expect(open.length).toBeGreaterThan(0);

    const source = await db
      .select()
      .from(alertSource)
      .where(eq(alertSource.workspaceId, team.workspaceId))
      .get();
    if (!source) throw new Error("expected an alert source");

    // A window shorter than the incident's age, rather than sleeping.
    await db
      .update(alertSource)
      .set({ config: { stalenessWindowMinutes: 1 } })
      .where(eq(alertSource.id, source.id));
    await db
      .update(incidentTable)
      .set({ lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) })
      .where(eq(incidentTable.id, open[0].id));

    const result = await sweepOnce(new Date(), [team.workspaceId]);
    expect(result.resolved).toBeGreaterThan(0);

    const after = await incidentsFor(team.workspaceId);
    const swept = after.find((i) => i.id === open[0].id);
    expect(swept?.resolvedAt).not.toBe(null);
    expect(swept?.autoResolved).toBe(true);
    expect(swept?.status).toBe("resolved");
  });
});
