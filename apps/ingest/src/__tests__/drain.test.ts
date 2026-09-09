import {
  FIRING_GROUP,
  RESOLVED_GROUP,
} from "@openstatus/alert-adapters/providers/alertmanager/fixtures";
import { db, eq } from "@openstatus/db";
import { alertInbox, alertSource } from "@openstatus/db/src/schema";
import { claimInboxRows } from "@openstatus/services/alert-inbox";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { drainOnce } from "../inbox/drain";
import { app } from "../index";
import { fingerprintFor } from "../lib/dedup";
import {
  cleanupIngestFixture,
  createIngestFixture,
  deadLettersFor,
  type IngestFixture,
  drainUntilIdle,
  inboxRowsFor,
  incidentsFor,
  sourceIdsFor,
  webhookRequest,
} from "./helpers";

let fixture: IngestFixture;

beforeAll(async () => {
  fixture = await createIngestFixture(["write"]);
});

afterAll(async () => {
  await cleanupIngestFixture(fixture);
});

// Scoped so parallel test files never claim each other's rows.
async function drainMine() {
  await drainUntilIdle(drainOnce, await sourceIdsFor(fixture.workspaceId));
}

async function post(body: unknown) {
  const res = await app.request(
    webhookRequest({
      provider: "alertmanager",
      token: fixture.token,
      body,
    }),
  );
  expect(res.status).toBe(202);
}

function firing(groupKey: string, alertFingerprint: string) {
  return {
    ...FIRING_GROUP,
    groupKey,
    alerts: [{ ...FIRING_GROUP.alerts[0], fingerprint: alertFingerprint }],
  };
}

function resolved(groupKey: string, alertFingerprint: string) {
  return {
    ...RESOLVED_GROUP,
    groupKey,
    alerts: [{ ...RESOLVED_GROUP.alerts[0], fingerprint: alertFingerprint }],
  };
}

async function incidentForGroup(groupKey: string) {
  const all = await incidentsFor(fixture.workspaceId);
  const source = await db
    .select()
    .from(alertSource)
    .where(eq(alertSource.workspaceId, fixture.workspaceId))
    .get();
  if (!source) throw new Error("expected an alert source");
  const fp = await fingerprintFor(source.id, groupKey);
  return all.find((i) => i.fingerprint === fp) ?? null;
}

describe("drainer", () => {
  test("a firing payload becomes one open incident", async () => {
    const group = `open-${Date.now()}`;
    await post(firing(group, `${group}-a`));
    await drainMine();

    const incident = await incidentForGroup(group);
    expect(incident).not.toBe(null);
    expect(incident?.origin).toBe("external");
    expect(incident?.resolvedAt).toBe(null);
  });

  test("a repeated firing refreshes rather than duplicating", async () => {
    const group = `repeat-${Date.now()}`;
    await post(firing(group, `${group}-a`));
    await drainMine();
    const first = await incidentForGroup(group);
    expect(first).not.toBe(null);

    await post(firing(group, `${group}-b`));
    await drainMine();

    const all = await incidentsFor(fixture.workspaceId);
    const matching = all.filter((i) => i.fingerprint === first?.fingerprint);
    expect(matching).toHaveLength(1);
    expect(matching[0].lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      first?.lastSeenAt.getTime() ?? 0,
    );
  });

  test("a resolved payload closes the incident it opened", async () => {
    const group = `close-${Date.now()}`;
    await post(firing(group, `${group}-a`));
    await drainMine();
    expect((await incidentForGroup(group))?.resolvedAt).toBe(null);

    await post(resolved(group, `${group}-r`));
    await drainMine();

    const incident = await incidentForGroup(group);
    expect(incident?.resolvedAt).not.toBe(null);
    expect(incident?.status).toBe("resolved");
    expect(incident?.autoResolved).toBe(true);
  });

  test("a resolved row cannot be claimed ahead of the firing it closes", async () => {
    const source = await db
      .select()
      .from(alertSource)
      .where(eq(alertSource.workspaceId, fixture.workspaceId))
      .get();
    if (!source) throw new Error("expected an alert source");

    // Inserted directly: the ordering guarantee is a property of the claim
    // query, and going through HTTP would make the fixture depend on dedup.
    const now = Math.floor(Date.now() / 1000);
    const fp = `ordering-${now}`;
    const ids: number[] = [];
    for (const label of ["fire", "resolve"]) {
      const row = await db
        .insert(alertInbox)
        .values({
          alertSourceId: source.id,
          dedupKey: `${fp}-${label}`,
          rawBody: "{}",
          contentType: "application/json",
          externalId: null,
          fingerprint: fp,
          nextAttemptAt: now,
          deadlineAt: now + 600,
          receivedAt: now,
        })
        .returning()
        .get();
      ids.push(row.id);
    }

    const claimed = await claimInboxRows({
      workerId: `ordering-test-${now}`,
      limit: 20,
      leaseSeconds: 30,
      alertSourceIds: [source.id],
    });
    const fromGroup = claimed.filter((r) => r.fingerprint === fp);
    expect(fromGroup).toHaveLength(1);
    expect(fromGroup[0].id).toBe(ids[0]);

    for (const id of ids) {
      await db.delete(alertInbox).where(eq(alertInbox.id, id));
    }
  });
});

describe("replay", () => {
  test("an unparseable body dead-letters with the payload intact, and a corrected one processes", async () => {
    const source = await db
      .select()
      .from(alertSource)
      .where(eq(alertSource.workspaceId, fixture.workspaceId))
      .get();
    if (!source) throw new Error("expected an alert source");

    const now = Math.floor(Date.now() / 1000);
    const broken = await db
      .insert(alertInbox)
      .values({
        alertSourceId: source.id,
        dedupKey: `replay-broken-${now}`,
        rawBody: JSON.stringify({ shape: "the adapter cannot read" }),
        contentType: "application/json",
        externalId: null,
        fingerprint: "replay-fingerprint",
        nextAttemptAt: now,
        deadlineAt: now + 600,
        receivedAt: now,
      })
      .returning()
      .get();

    await drainMine();

    const dead = await deadLettersFor(fixture.workspaceId);
    const entry = dead.find((d) => d.inboxId === broken.id);
    expect(entry).toBeDefined();
    expect(entry?.rawBody).toContain("the adapter cannot read");
    expect(entry?.finalError).toContain("AdapterError");

    const stillThere = await db
      .select()
      .from(alertInbox)
      .where(eq(alertInbox.id, broken.id))
      .get();
    expect(stillThere).toBeUndefined();

    // "Fix the adapter" — replay the same logical event with a payload it reads.
    const fixed = await db
      .insert(alertInbox)
      .values({
        alertSourceId: source.id,
        dedupKey: `replay-fixed-${now}`,
        rawBody: JSON.stringify({ ...FIRING_GROUP, groupKey: "replayed" }),
        contentType: "application/json",
        externalId: null,
        fingerprint: "replay-fingerprint",
        nextAttemptAt: now,
        deadlineAt: now + 600,
        receivedAt: now,
      })
      .returning()
      .get();

    await drainMine();

    const settled = await db
      .select()
      .from(alertInbox)
      .where(eq(alertInbox.id, fixed.id))
      .get();
    expect(settled?.processingStatus).toBe("settled");
    expect(settled?.outcome).toBe("processed");
    expect(settled?.incidentId).not.toBe(null);
  });
});
