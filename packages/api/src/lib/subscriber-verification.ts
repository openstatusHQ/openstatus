import { type db as defaultDb, eq } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";
import { getChannel } from "@openstatus/subscriptions";
import { getStatusPageBaseUrl } from "@openstatus/utils";
import { TRPCError } from "@trpc/server";

export function buildSubscriberVerificationUrl(
  page: { slug?: string; customDomain?: string | null },
  token: string,
): string {
  const baseUrl = getStatusPageBaseUrl({
    slug: page.slug,
    customDomain: page.customDomain,
  });
  return `${baseUrl}/verify/${token}`;
}

/**
 * Emails the verification link to the subscriber's own address. The token
 * must never be handed back to the caller, or double opt-in is meaningless.
 */
export async function sendSubscriberVerification(
  db: typeof defaultDb,
  subscriberId: number,
): Promise<void> {
  const subscriber = await db.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.id, subscriberId),
    with: { page: true },
  });

  if (!subscriber?.email || !subscriber.token || subscriber.acceptedAt) {
    return;
  }

  const verifyUrl = buildSubscriberVerificationUrl(
    subscriber.page,
    subscriber.token,
  );

  const channel = getChannel("email");
  if (!channel) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Email channel not found",
    });
  }

  await channel.sendVerification?.(
    {
      id: subscriber.id,
      pageId: subscriber.pageId,
      pageName: subscriber.page.title,
      pageSlug: subscriber.page.slug,
      customDomain: subscriber.page.customDomain,
      componentIds: [],
      channelType: "email",
      email: subscriber.email,
      token: subscriber.token,
    },
    verifyUrl,
  );
}
