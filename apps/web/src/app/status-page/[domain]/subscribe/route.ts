import { z } from "zod";

import { and, eq, isNotNull } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import { SubscribeEmail, sendEmail } from "@openstatus/emails";

// TODO: use trpc route

export async function POST(
  req: Request,
  props: { params: Promise<{ domain: string }> },
) {
  const params = await props.params;
  const data = await req.json();
  const result = z.object({ email: z.string().email() }).parse(data);

  const pageData = await db
    .select()
    .from(page)
    .where(eq(page.slug, params.domain))
    .get();
  if (!pageData) {
    return new Response("Not found", { status: 401 });
  }

  const alreadySubscribed = await db
    .select()
    .from(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.email, data.email),
        eq(pageSubscriber.pageId, pageData?.id),
        isNotNull(pageSubscriber.acceptedAt),
      ),
    )
    .get();

  if (alreadySubscribed) {
    return new Response("Not found", { status: 401 });
  }

  const token = crypto.randomUUID();

  await db
    .insert(pageSubscriber)
    .values({
      pageId: pageData.id,
      email: result.email,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    })
    .execute();

  const link = `https://${pageData.slug}.openstatus.dev/verify/${token}`;

  await sendEmail({
    react: SubscribeEmail({
      link,
      page: pageData.title,
    }),
    from: "OpenStatus <notification@notifications.openstatus.dev>",
    to: [result.email],
    subject: `Verify your subscription to ${pageData.title}`,
  });

  return Response.json({ message: "Hello world" });
}
