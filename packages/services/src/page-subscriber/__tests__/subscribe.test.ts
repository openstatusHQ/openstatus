import { eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import type {
  PageUpdate,
  Subscription,
  SubscriptionChannel,
} from "@openstatus/subscriptions";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB } from "../../context";
import { expireSelfSignupVerification } from "../expire-verification.ts";
import {
  subscribeSelfSignupSubscriber,
  upsertSelfSignupSubscriber,
} from "../index.ts";

let workspaceId: number;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

async function createStatusPage(
  tx: DB,
  overrides: { customDomain?: string } = {},
) {
  return tx
    .insert(page)
    .values({
      workspaceId,
      title: "Subscriber Test Page",
      description: "Subscriber email verification test",
      slug: `subscriber-test-${crypto.randomUUID()}`,
      customDomain: overrides.customDomain ?? "",
      published: true,
    })
    .returning()
    .get();
}

function verificationChannel(
  onSend: (subscription: Subscription, verifyUrl: string) => void,
): SubscriptionChannel {
  return {
    id: "email",
    validateConfig: () => Promise.resolve({ valid: true }),
    sendNotifications: (_subscriptions: Subscription[], _update: PageUpdate) =>
      Promise.resolve(),
    sendVerification: (subscription, verifyUrl) => {
      onSend(subscription, verifyUrl);
      return Promise.resolve();
    },
  };
}

describe("subscribeSelfSignupSubscriber", () => {
  test("creates a pending subscriber and sends its verification email", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx, {
        customDomain: "status.example.com",
      });
      const deliveries: { subscription: Subscription; verifyUrl: string }[] =
        [];

      const result = await subscribeSelfSignupSubscriber({
        input: {
          email: "subscriber@example.com",
          pageId: statusPage.id,
        },
        db: tx,
        channel: verificationChannel((subscription, verifyUrl) => {
          deliveries.push({ subscription, verifyUrl });
        }),
      });

      expect(result.success).toBe(true);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]?.subscription.email).toBe("subscriber@example.com");
      expect(deliveries[0]?.verifyUrl).toBe(
        `https://status.example.com/verify/${deliveries[0]?.subscription.token}`,
      );
    });
  });

  test("uses the hosted page URL when no custom domain is configured", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      let verifyUrl = "";
      let verificationToken: string | undefined;

      await subscribeSelfSignupSubscriber({
        input: {
          email: "hosted-subscriber@example.com",
          pageId: statusPage.id,
        },
        db: tx,
        channel: verificationChannel((subscription, url) => {
          verificationToken = subscription.token;
          verifyUrl = url;
        }),
      });

      expect(verifyUrl).toBe(
        `https://${statusPage.slug}.openstatus.dev/verify/${verificationToken}`,
      );
    });
  });

  test("does not send another email for an existing pending subscription", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      let deliveries = 0;
      const channel = verificationChannel(() => {
        deliveries += 1;
      });
      const input = {
        email: "pending-subscriber@example.com",
        pageId: statusPage.id,
      };

      await subscribeSelfSignupSubscriber({ input, db: tx, channel });
      const initialPending = await tx.query.pageSubscriber.findFirst({
        where: eq(pageSubscriber.email, input.email),
      });
      await expect(
        subscribeSelfSignupSubscriber({ input, db: tx, channel }),
      ).rejects.toThrow("A confirmation link was already sent");
      const pendingAfterRetry = await tx.query.pageSubscriber.findFirst({
        where: eq(pageSubscriber.email, input.email),
      });
      expect(deliveries).toBe(1);
      expect(pendingAfterRetry?.expiresAt).toEqual(initialPending?.expiresAt);
    });
  });

  test("allows an immediate retry when verification delivery fails", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      const input = {
        email: "failed-delivery@example.com",
        pageId: statusPage.id,
      };
      const deliveryError = new Error("Email provider unavailable");
      const failedChannel: SubscriptionChannel = {
        id: "email",
        validateConfig: () => Promise.resolve({ valid: true }),
        sendNotifications: () => Promise.resolve(),
        sendVerification: () => Promise.reject(deliveryError),
      };

      await expect(
        subscribeSelfSignupSubscriber({
          input,
          db: tx,
          channel: failedChannel,
        }),
      ).rejects.toThrow("Email provider unavailable");

      const pending = await tx.query.pageSubscriber.findFirst({
        where: eq(pageSubscriber.email, input.email),
      });
      expect(pending?.expiresAt?.getTime()).toBeLessThanOrEqual(Date.now());

      let deliveries = 0;
      await expect(
        subscribeSelfSignupSubscriber({
          input,
          db: tx,
          channel: verificationChannel(() => {
            deliveries += 1;
          }),
        }),
      ).resolves.toEqual({ success: true });
      expect(deliveries).toBe(1);
    });
  });

  test("preserves the delivery error when verification cleanup fails", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      const deliveryError = new Error("Email provider unavailable");
      const failedChannel: SubscriptionChannel = {
        id: "email",
        validateConfig: () => Promise.resolve({ valid: true }),
        sendNotifications: () => Promise.resolve(),
        sendVerification: () => Promise.reject(deliveryError),
      };
      let cleanupAttempts = 0;

      await expect(
        subscribeSelfSignupSubscriber({
          input: {
            email: "failed-cleanup@example.com",
            pageId: statusPage.id,
          },
          db: tx,
          channel: failedChannel,
          expireVerification: () => {
            cleanupAttempts += 1;
            return Promise.reject(new Error("Database unavailable"));
          },
        }),
      ).rejects.toBe(deliveryError);
      expect(cleanupAttempts).toBe(3);
    });
  });

  test("retries verification cleanup after transient failures", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      const email = "transient-cleanup@example.com";
      const deliveryError = new Error("Email provider unavailable");
      let cleanupAttempts = 0;

      await expect(
        subscribeSelfSignupSubscriber({
          input: { email, pageId: statusPage.id },
          db: tx,
          channel: {
            id: "email",
            validateConfig: () => Promise.resolve({ valid: true }),
            sendNotifications: () => Promise.resolve(),
            sendVerification: () => Promise.reject(deliveryError),
          },
          expireVerification: (input) => {
            cleanupAttempts += 1;
            if (cleanupAttempts < 3) {
              return Promise.reject(new Error("Database unavailable"));
            }
            return expireSelfSignupVerification(input);
          },
        }),
      ).rejects.toBe(deliveryError);

      const pending = await tx.query.pageSubscriber.findFirst({
        where: eq(pageSubscriber.email, email),
      });
      expect(cleanupAttempts).toBe(3);
      expect(pending?.expiresAt?.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  test("does not send another email for a verified subscription", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      const input = {
        email: "verified-subscriber@example.com",
        pageId: statusPage.id,
      };
      const subscriber = await upsertSelfSignupSubscriber({ input, db: tx });
      await tx
        .update(pageSubscriber)
        .set({ acceptedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id));
      let deliveries = 0;

      await expect(
        subscribeSelfSignupSubscriber({
          input,
          db: tx,
          channel: verificationChannel(() => {
            deliveries += 1;
          }),
        }),
      ).rejects.toThrow("Email already subscribed");
      expect(deliveries).toBe(0);
    });
  });

  test("allows adapters to preserve an idempotent accepted response", async () => {
    await withTestTransaction(async (tx) => {
      const statusPage = await createStatusPage(tx);
      const deliveries: Subscription[] = [];
      const input = {
        email: "subscribe-accepted-adapter@example.com",
        pageId: statusPage.id,
      };
      const subscriber = await upsertSelfSignupSubscriber({ input, db: tx });
      await tx
        .update(pageSubscriber)
        .set({ acceptedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id))
        .run();

      const result = await subscribeSelfSignupSubscriber({
        input,
        db: tx,
        channel: verificationChannel((subscription) => {
          deliveries.push(subscription);
        }),
        allowAccepted: true,
      });

      expect(result).toEqual({ success: true });
      expect(deliveries).toHaveLength(0);
    });
  });
});
