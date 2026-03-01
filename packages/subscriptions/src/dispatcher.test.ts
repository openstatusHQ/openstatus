import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  pageSubscriber,
  pageSubscriberToPageComponent,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { dispatchPageUpdate } from "./dispatcher";
import type { PageUpdate } from "./types";

// RESEND_API_KEY is set in test-preload.ts (see bunfig.toml) so @openstatus/emails
// loads successfully and EmailClient prototype methods can be spied on.

const sendStatusReportUpdateMock = spyOn(
  EmailClient.prototype,
  "sendStatusReportUpdate",
).mockResolvedValue(undefined);

// IDs present in the seeded database
const PAGE_ID = 1; // slug: "status"
const COMPONENT_1 = 1;
const COMPONENT_2 = 2;

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
  sendStatusReportUpdateMock.mockClear();
});

// ─── dispatchPageUpdate - component filtering ─────────────────────────────────

describe("dispatchPageUpdate - component filtering", () => {
  test("notifies entire-page and component-1 subscriber when update affects component 1", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_1] }),
    );

    expect(sendStatusReportUpdateMock).toHaveBeenCalledTimes(1);
    const { subscribers } = sendStatusReportUpdateMock.mock.calls[0][0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).toContain(EMAILS.entirePage);
    expect(emails).toContain(EMAILS.component1);
    expect(emails).not.toContain(EMAILS.component2);
  });

  test("notifies entire-page and component-2 subscriber when update affects component 2", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_2] }),
    );

    const { subscribers } = sendStatusReportUpdateMock.mock.calls[0][0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).toContain(EMAILS.entirePage);
    expect(emails).toContain(EMAILS.component2);
    expect(emails).not.toContain(EMAILS.component1);
  });

  test("notifies all subscribers when update affects both components", async () => {
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_1, COMPONENT_2] }),
    );

    const { subscribers } = sendStatusReportUpdateMock.mock.calls[0][0];
    const emails = subscribers.map((s: { email: string }) => s.email);

    expect(emails).toContain(EMAILS.entirePage);
    expect(emails).toContain(EMAILS.component1);
    expect(emails).toContain(EMAILS.component2);
  });

  test("notifies only the entire-page subscriber when update has no affected components", async () => {
    await dispatchPageUpdate(makePageUpdate({ pageComponentIds: [] }));

    expect(sendStatusReportUpdateMock).toHaveBeenCalledTimes(1);
    const { subscribers } = sendStatusReportUpdateMock.mock.calls[0][0];

    expect(subscribers).toHaveLength(1);
    expect(subscribers[0].email).toBe(EMAILS.entirePage);
  });

  test("does not notify component subscribers when update affects a different component", async () => {
    // Only component 1 is affected — component 2 subscriber should be skipped
    await dispatchPageUpdate(
      makePageUpdate({ pageComponentIds: [COMPONENT_1] }),
    );

    const { subscribers } = sendStatusReportUpdateMock.mock.calls[0][0];
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

    expect(sendStatusReportUpdateMock).not.toHaveBeenCalled();
  });

  test("does not propagate channel failure — resolves even when sendStatusReportUpdate throws", async () => {
    sendStatusReportUpdateMock.mockRejectedValueOnce(new Error("SMTP failure"));

    await expect(
      dispatchPageUpdate(makePageUpdate({ pageComponentIds: [] })),
    ).resolves.toBeUndefined();
  });
});
