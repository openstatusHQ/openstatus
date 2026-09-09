import {
  FIRING_GROUP,
  RESOLVED_GROUP,
} from "@openstatus/alert-adapters/providers/alertmanager/fixtures";
import { db, eq } from "@openstatus/db";
import { alertSource } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { app } from "../index";
import {
  cleanupIngestFixture,
  createIngestFixture,
  type IngestFixture,
  inboxRowsFor,
  webhookRequest,
} from "./helpers";

let fixture: IngestFixture;
let readOnly: IngestFixture;

beforeAll(async () => {
  fixture = await createIngestFixture(["write"]);
  readOnly = await createIngestFixture(["read"]);
});

afterAll(async () => {
  await cleanupIngestFixture(fixture);
  await cleanupIngestFixture(readOnly);
});

describe("accept path", () => {
  test("one payload produces exactly one inbox row and auto-creates the source", async () => {
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: fixture.token,
        body: FIRING_GROUP,
      }),
    );
    expect(res.status).toBe(202);

    const rows = await inboxRowsFor(fixture.workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0].processingStatus).toBe("pending");
    expect(rows[0].fingerprint).not.toBe(null);
    expect(rows[0].rawBody.length).toBeGreaterThan(0);

    const sources = await db
      .select()
      .from(alertSource)
      .where(eq(alertSource.workspaceId, fixture.workspaceId))
      .all();
    expect(sources).toHaveLength(1);
    expect(sources[0].provider).toBe("alertmanager");
  });

  test("replaying the identical payload adds no row", async () => {
    const before = (await inboxRowsFor(fixture.workspaceId)).length;
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: fixture.token,
        body: FIRING_GROUP,
      }),
    );
    const payload = await res.json();

    expect(res.status).toBe(202);
    expect(payload.duplicate).toBe(true);
    expect((await inboxRowsFor(fixture.workspaceId)).length).toBe(before);
  });

  test("a resolved payload for the same group is a distinct row", async () => {
    const before = (await inboxRowsFor(fixture.workspaceId)).length;
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: fixture.token,
        body: RESOLVED_GROUP,
      }),
    );
    expect(res.status).toBe(202);
    expect((await inboxRowsFor(fixture.workspaceId)).length).toBe(before + 1);
  });

  test("the ?key= fallback authenticates too", async () => {
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: fixture.token,
        body: { ...FIRING_GROUP, groupKey: "query-key-group" },
        useQueryKey: true,
      }),
    );
    expect(res.status).toBe(202);
  });

  test("an unparseable payload is still stored, settled invalid", async () => {
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: fixture.token,
        body: { totally: "wrong" },
      }),
    );
    expect(res.status).toBe(202);

    const rows = await inboxRowsFor(fixture.workspaceId);
    const invalid = rows.filter((r) => r.outcome === "invalid");
    expect(invalid.length).toBeGreaterThan(0);
    expect(invalid[0].rawBody).toContain("totally");
    expect(invalid[0].fingerprint).toBe(null);
  });
});

describe("auth", () => {
  test("no credentials is 401 and writes nothing", async () => {
    const res = await app.request(
      webhookRequest({ provider: "alertmanager", body: FIRING_GROUP }),
    );
    expect(res.status).toBe(401);
  });

  test("an unknown key is 401", async () => {
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: "os_deadbeefdeadbeefdeadbeefdeadbeef",
        body: FIRING_GROUP,
      }),
    );
    expect(res.status).toBe(401);
  });

  test("a read-only key cannot post alerts and writes nothing", async () => {
    const res = await app.request(
      webhookRequest({
        provider: "alertmanager",
        token: readOnly.token,
        body: FIRING_GROUP,
      }),
    );
    expect(res.status).not.toBe(202);
    expect(await inboxRowsFor(readOnly.workspaceId)).toHaveLength(0);
  });

  test("an unknown provider is rejected", async () => {
    const res = await app.request(
      webhookRequest({
        provider: "datadog",
        token: fixture.token,
        body: FIRING_GROUP,
      }),
    );
    expect(res.status).toBe(401);
  });
});
