"use server";

import { z } from "zod";

import { trackAnalytics } from "@openstatus/analytics";
import { and, eq, sql } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import { sendEmail, SubscribeEmail } from "@openstatus/emails";

const schema = z.object({
  email: z
    .string({
      invalid_type_error: "Invalid Email",
    })
    .email(),
  slug: z.string(),
});

export async function handleSubscribe(formData: FormData) {
  const validatedFields = schema.safeParse({
    email: formData.get("email"),
    slug: formData.get("slug"),
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    return {
      error: fieldErrors?.email?.[0] || "Invalid form data",
    };
  }

  const { slug } = validatedFields.data;

  const pageData = await db
    .select()
    .from(page)
    .where(
      // REMINDER: customDomain for pro users
      sql`lower(${page.slug}) = ${slug} OR  lower(${page.customDomain}) = ${slug}`,
    )
    .get();

  if (!pageData) {
    return {
      error: "Page not found",
    };
  }

  const alreadySubscribed = await db
    .select()
    .from(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.email, validatedFields.data.email),
        eq(pageSubscriber.pageId, pageData.id),
      ),
    )
    .get();

  if (alreadySubscribed) {
    return {
      error: "Already subscribed",
    };
  }

  const token = crypto.randomUUID();

  await sendEmail({
    react: SubscribeEmail({
      domain: pageData.slug,
      token: token,
      page: pageData.title,
    }),
    from: "OpenStatus <notification@notifications.openstatus.dev>",
    to: [validatedFields.data.email],
    subject: "Verify your subscription to " + pageData.title,
  });

  await db
    .insert(pageSubscriber)
    .values({
      email: validatedFields.data.email,
      token,
      pageId: pageData.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    })
    .execute();

  await trackAnalytics({
    event: "Subscribe to Status Page",
    slug: pageData.slug,
  });
}
