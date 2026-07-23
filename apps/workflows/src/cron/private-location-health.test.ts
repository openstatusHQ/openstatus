import { db, eq } from "@openstatus/db";
import { auditLog, privateLocation } from "@openstatus/db/src/schema";
import {
  afterEach,
  assertSpyCalls,
  beforeEach,
  describe,
  expect,
  type Stub,
  stub,
  test,
} from "@openstatus/test-utils";

import {
  emailClient,
  runPrivateLocationHealth,
  STALE_THRESHOLD_MS,
} from "./private-location-health";

const TEST_LOCATION_ID = 9301;
const TEST_WORKSPACE_ID = 1;
const NOW = new Date("2026-07-23T12:00:00Z");
const FRESH = new Date(NOW.getTime() - 60 * 1000);
const STALE = new Date(NOW.getTime() - STALE_THRESHOLD_MS - 60 * 1000);

// biome-ignore lint/suspicious/noExplicitAny: email stub
type AnyStub = Stub<any>;

async function seedLocation(
  status: "active" | "error",
  lastSeenAt: Date | null,
) {
  await db
    .delete(privateLocation)
    .where(eq(privateLocation.id, TEST_LOCATION_ID));
  await db
    .insert(privateLocation)
    .values({
      id: TEST_LOCATION_ID,
      name: "health-test-location",
      token: "health-test-token",
      status,
      lastSeenAt,
      workspaceId: TEST_WORKSPACE_ID,
      createdAt: new Date(),
    })
    .run();
}

function readStatus() {
  return db
    .select({ status: privateLocation.status })
    .from(privateLocation)
    .where(eq(privateLocation.id, TEST_LOCATION_ID))
    .get();
}

describe("runPrivateLocationHealth", () => {
  let mockEmail: AnyStub;

  beforeEach(() => {
    mockEmail = stub(emailClient, "sendPrivateLocationAlert", () =>
      Promise.resolve(),
    ) as AnyStub;
  });

  afterEach(async () => {
    mockEmail.restore();
    await db
      .delete(auditLog)
      .where(eq(auditLog.entityId, String(TEST_LOCATION_ID)));
    await db
      .delete(privateLocation)
      .where(eq(privateLocation.id, TEST_LOCATION_ID));
  });

  test("active + stale → error + email", async () => {
    await seedLocation("active", STALE);

    await runPrivateLocationHealth(NOW);

    expect((await readStatus())?.status).toBe("error");
    assertSpyCalls(mockEmail, 1);
    expect(mockEmail.calls[0].args[0].status).toBe("error");
    expect(mockEmail.calls[0].args[0].locationName).toBe(
      "health-test-location",
    );
  });

  test("error + fresh → active + email", async () => {
    await seedLocation("error", FRESH);

    await runPrivateLocationHealth(NOW);

    expect((await readStatus())?.status).toBe("active");
    assertSpyCalls(mockEmail, 1);
    expect(mockEmail.calls[0].args[0].status).toBe("recovered");
  });

  test("active + fresh → untouched, no email", async () => {
    await seedLocation("active", FRESH);

    await runPrivateLocationHealth(NOW);

    expect((await readStatus())?.status).toBe("active");
    assertSpyCalls(mockEmail, 0);
  });

  test("error + stale → untouched, no email", async () => {
    await seedLocation("error", STALE);

    await runPrivateLocationHealth(NOW);

    expect((await readStatus())?.status).toBe("error");
    assertSpyCalls(mockEmail, 0);
  });

  test("lastSeenAt NULL → skipped regardless of status", async () => {
    await seedLocation("error", null);

    await runPrivateLocationHealth(NOW);

    expect((await readStatus())?.status).toBe("error");
    assertSpyCalls(mockEmail, 0);
  });
});
