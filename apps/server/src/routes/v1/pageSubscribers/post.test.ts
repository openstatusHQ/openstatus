import { and, db, eq, isNull } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";
import { delivery, resend } from "@openstatus/emails/src/send";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import { assertSpyCalls, stub } from "@std/testing/mock";

import { app } from "@/index";

import { PageSubscriberSchema } from "./schema";

test("create a page subscription", async () => {
  const res = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "ping@openstatus.dev" }),
  });

  const result = PageSubscriberSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created page subscriber
  if (result.success) {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.id, result.data.id));
  }
});

test("sends the same redesigned verification email as the status page form", async () => {
  const enabled = stub(delivery, "enabled", () => true);
  const send = stub(resend.emails, "send", () =>
    Promise.resolve({ data: { id: "email_1" }, error: null } as never),
  );

  const email = "verify-mail@openstatus.dev";
  const cleanup = () =>
    db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));

  try {
    await cleanup();
    const res = await app.request("/v1/page_subscriber/1/update", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    expect(res.status).toBe(200);

    assertSpyCalls(send, 1);
    const payload = send.calls[0].args[0];
    expect(payload.to).toEqual([email]);
    expect(payload.from).toBe(
      "Status Page <notifications@notifications.openstatus.dev>",
    );
    expect(payload.subject).toMatch(/^Confirm your subscription to /);
    // the route calls the template as a function, so this is its <Layout>
    expect(payload.react.props.brand.name).toMatch(/Status$/);
    expect(payload.react.props.pill.label).toBe("Confirm");
  } finally {
    await cleanup();
    send.restore();
    enabled.restore();
  }
});

test("create a scubscriber with invalid email should return a 400", async () => {
  const res = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "ping" }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("re-subscribing after unsubscribe succeeds and does not leave duplicate active rows", async () => {
  const email = "resubscribe-after-unsubscribe@openstatus.dev";

  // Clean any pre-existing rows from a previous run
  await db
    .delete(pageSubscriber)
    .where(and(eq(pageSubscriber.email, email), eq(pageSubscriber.pageId, 1)));

  // 1. Subscribe
  const firstRes = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  expect(firstRes.status).toBe(200);
  const first = PageSubscriberSchema.parse(await firstRes.json());

  // 2. Mark the subscriber as accepted + unsubscribed (simulates the
  // user verifying, then later unsubscribing via one-click).
  await db
    .update(pageSubscriber)
    .set({ acceptedAt: new Date(), unsubscribedAt: new Date() })
    .where(eq(pageSubscriber.id, first.id));

  // 3. Subscribe the same email again — should succeed.
  const secondRes = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  expect(secondRes.status).toBe(200);

  // There must be exactly one ACTIVE row (unsubscribedAt IS NULL) for the email.
  const active = await db
    .select()
    .from(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.email, email),
        eq(pageSubscriber.pageId, 1),
        isNull(pageSubscriber.unsubscribedAt),
      ),
    )
    .all();
  expect(active.length).toBe(1);

  // Cleanup
  await db
    .delete(pageSubscriber)
    .where(and(eq(pageSubscriber.email, email), eq(pageSubscriber.pageId, 1)));
});

test("subscribing when an active subscription already exists returns 409", async () => {
  const email = "already-active@openstatus.dev";

  await db
    .delete(pageSubscriber)
    .where(and(eq(pageSubscriber.email, email), eq(pageSubscriber.pageId, 1)));

  const firstRes = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  expect(firstRes.status).toBe(200);
  const first = PageSubscriberSchema.parse(await firstRes.json());

  // Second subscribe with an already-active (but pending) entry should conflict.
  const secondRes = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  expect(secondRes.status).toBe(409);

  await db.delete(pageSubscriber).where(eq(pageSubscriber.id, first.id));
});

test("subscribing is case-insensitive on email", async () => {
  const email = "Case.Sensitive@OpenStatus.dev";

  await db
    .delete(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.email, email.toLowerCase()),
        eq(pageSubscriber.pageId, 1),
      ),
    );

  const firstRes = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  expect(firstRes.status).toBe(200);
  const first = PageSubscriberSchema.parse(await firstRes.json());

  // Same email in different case — should conflict.
  const secondRes = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: email.toUpperCase() }),
  });
  expect(secondRes.status).toBe(409);

  await db.delete(pageSubscriber).where(eq(pageSubscriber.id, first.id));
});
