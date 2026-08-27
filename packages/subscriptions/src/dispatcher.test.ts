import "./test-preload.ts";
import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenanceUpdate,
  maintenancesToPageComponents,
  pageSubscriber,
  pageSubscriberToPageComponent,
} from "@openstatus/db/src/schema";
import {
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { EmailClient } from "@openstatus/emails";
import { expect } from "@std/expect";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  test,
} from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";

import { dispatchMaintenanceUpdate, dispatchPageUpdate } from "./dispatcher";
import type { PageUpdate } from "./types";

// RESEND_API_KEY is set in test-preload.ts (see bunfig.toml) so @openstatus/emails
// loads successfully and EmailClient prototype methods can be spied on.

let sendStatusReportUpdateMock: Stub<EmailClient>;
let rejectNextSend: Error | null = null;

// Built in `beforeAll` — a private page keeps the subscriber set this suite
// dispatches to independent of anything else running against the database.
let PAGE_ID: number;
let WORKSPACE_ID: number;
let COMPONENT_1: number;
let COMPONENT_1_NAME: string;
let COMPONENT_2: number;

const EMAILS = {
  entirePage: "dispatcher-page-test@example.com",
  component1: "dispatcher-comp1-test@example.com",
  component2: "dispatcher-comp2-test@example.com",
};

// Captured IDs after insert
let _subEntirePageId: number;
let subComponent1Id: number;
let subComponent2Id: number;

function makePageUpdate(overrides: Partial<PageUpdate> = {}): PageUpdate {
  return {
    id: 1,
    pageId: PAGE_ID,
    title: "Test Incident",
    status: "investigating",
    message: "We are investigating.",
    pageComponentIds: [],
    pageComponents: [],
    date: new Date().toISOString(),
    ...overrides,
  };
}

async function cleanAll() {
  for (const email of Object.values(EMAILS)) {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  }
}

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  WORKSPACE_ID = workspace.id;
  PAGE_ID = (await createPage(workspace.id)).id;
  const component1 = await createPageComponent(workspace.id, PAGE_ID);
  COMPONENT_1 = component1.id;
  COMPONENT_1_NAME = component1.name;
  COMPONENT_2 = (await createPageComponent(workspace.id, PAGE_ID, { order: 1 }))
    .id;

  await cleanAll();

  const insertAccepted = async (email: string) => {
    return db
      .insert(pageSubscriber)
      .values({
        channelType: "email",
        email,
        pageId: PAGE_ID,
        token: crypto.randomUUID(),
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning()
      .get();
  };

  const subEntirePage = await insertAccepted(EMAILS.entirePage);
  const subComponent1 = await insertAccepted(EMAILS.component1);
  const subComponent2 = await insertAccepted(EMAILS.component2);

  _subEntirePageId = subEntirePage.id;
  subComponent1Id = subComponent1.id;
  subComponent2Id = subComponent2.id;

  // subEntirePage has no component associations → entire-page scope
  // subComponent1 subscribes to component 1 only
  await db
    .insert(pageSubscriberToPageComponent)
    .values({ pageSubscriberId: subComponent1Id, pageComponentId: COMPONENT_1 })
    .run();

  // subComponent2 subscribes to component 2 only
  await db
    .insert(pageSubscriberToPageComponent)
    .values({ pageSubscriberId: subComponent2Id, pageComponentId: COMPONENT_2 })
    .run();
});

afterAll(cleanAll);

beforeEach(() => {
  rejectNextSend = null;
  sendStatusReportUpdateMock = stub(
    EmailClient.prototype,
    "sendStatusReportUpdate",
    () => {
      if (rejectNextSend) {
        const error = rejectNextSend;
        rejectNextSend = null;
        return Promise.reject(error);
      }
      return Promise.resolve(undefined);
    },
  );
});

afterEach(() => {
  sendStatusReportUpdateMock.restore();
});

// ─── dispatchPageUpdate - component filtering ─────────────────────────────────

describe("dispatchPageUpdate - component filtering", () => {
  test("notifies entire-page and component-1 subscriber when update affects component 1", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_1] }),
    );

    assertSpyCalls(sendStatusReportUpdateMock, 1);
    const { subscribers } = sendStatusReportUpdateMock.calls[0].args[0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).toContain(EMAILS.entirePage);
    expect(emails).toContain(EMAILS.component1);
    expect(emails).not.toContain(EMAILS.component2);
  });

  test("notifies entire-page and component-2 subscriber when update affects component 2", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_2] }),
    );

    const { subscribers } = sendStatusReportUpdateMock.calls[0].args[0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).toContain(EMAILS.entirePage);
    expect(emails).toContain(EMAILS.component2);
    expect(emails).not.toContain(EMAILS.component1);
  });

  test("notifies all subscribers when update affects both components", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_1, COMPONENT_2] }),
    );

    const { subscribers } = sendStatusReportUpdateMock.calls[0].args[0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).toContain(EMAILS.entirePage);
    expect(emails).toContain(EMAILS.component1);
    expect(emails).toContain(EMAILS.component2);
  });

  test("notifies only the entire-page subscriber when update has no affected components", async () => {
    await dispatchPageUpdate(makePageUpdate({ pageComponentIds: [] }));

    assertSpyCalls(sendStatusReportUpdateMock, 1);
    const { subscribers } = sendStatusReportUpdateMock.calls[0].args[0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    // Assert only against this suite's own subscribers — package test suites
    // run in parallel against the same seeded page, so an exact count over
    // all recipients races with concurrently inserted subscribers.
    const ownEmails = emails.filter((e: string) =>
      Object.values(EMAILS).includes(e),
    );
    expect(ownEmails).toEqual([EMAILS.entirePage]);
  });

  test("does not notify component subscribers when update affects a different component", async () => {
    // Only component 1 is affected — component 2 subscriber should be skipped
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_1] }),
    );

    const { subscribers } = sendStatusReportUpdateMock.calls[0].args[0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).not.toContain(EMAILS.component2);
  });
});

// ─── dispatchPageUpdate - edge cases ─────────────────────────────────────────

describe("dispatchPageUpdate - edge cases", () => {
  test("does not call sendNotifications for a non-existent page", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageId: 99999, pageComponentIds: [COMPONENT_1] }),
    );

    assertSpyCalls(sendStatusReportUpdateMock, 0);
  });

  test("does not propagate channel failure — resolves even when sendStatusReportUpdate throws", async () => {
    rejectNextSend = new Error("SMTP failure");

    await expect(
      dispatchPageUpdate(makePageUpdate({ pageComponentIds: [] })),
    ).resolves.toBeUndefined();
  });
});

describe("dispatchMaintenanceUpdate", () => {
  test("dispatches the selected update with parent schedule and components", async () => {
    const startsAt = new Date("2026-08-10T10:00:00.000Z");
    const endsAt = new Date("2026-08-10T11:00:00.000Z");
    const occurredAt = new Date("2026-08-07T14:00:00.000Z");
    const record = await db
      .insert(maintenance)
      .values({
        workspaceId: WORKSPACE_ID,
        pageId: PAGE_ID,
        title: "Database maintenance",
        message: "parent message",
        from: startsAt,
        to: endsAt,
      })
      .returning()
      .get();

    try {
      await db
        .insert(maintenancesToPageComponents)
        .values({
          maintenanceId: record.id,
          pageComponentId: COMPONENT_1,
        })
        .run();
      const update = await db
        .insert(maintenanceUpdate)
        .values({
          maintenanceId: record.id,
          message: "specific update message",
          date: occurredAt,
        })
        .returning()
        .get();

      await dispatchMaintenanceUpdate(update.id);

      const args = sendStatusReportUpdateMock.calls[0].args[0];
      expect(args.message).toBe("specific update message");
      expect(args.date).toBe(occurredAt.toISOString());
      expect(args.pageComponents).toContain(COMPONENT_1_NAME);
      expect(args.idempotencyKey).toMatch(
        new RegExp(`^status-report-update:${update.id}:`),
      );
    } finally {
      await db.delete(maintenance).where(eq(maintenance.id, record.id));
    }
  });
});
