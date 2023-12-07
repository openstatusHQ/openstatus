import { z } from "zod";

import { and, eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page, statusReportSubscriber } from "@openstatus/db/src/schema";
import { sendEmail, SubscribeEmail } from "@openstatus/emails";

export async function POST(
  req: Request,
  { params }: { params: { domain: string } },
) {
  //
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
    .from(statusReportSubscriber)
    .where(
      and(
        eq(statusReportSubscriber.email, data.email),
        eq(statusReportSubscriber.statusReportId, pageData?.id),
      ),
    )
    .get();

  if (alreadySubscribed) {
    return new Response("Not found", { status: 401 });
  }

  const verificationToken = (Math.random() + 1).toString(36).substring(10);

  await sendEmail({
    react: SubscribeEmail({
      domain: params.domain,
      token: verificationToken,
      page: pageData.title,
    }),
    from: "OpenStatus <notification@openstatus.dev>",
    to: [result.email],
    subject: "Verify your subscription",
  });
  await db
    .insert(statusReportSubscriber)
    .values({
      email: result.email,
      verificationToken,
    })
    .execute();
  return Response.json({ message: "Hello world" });
}
