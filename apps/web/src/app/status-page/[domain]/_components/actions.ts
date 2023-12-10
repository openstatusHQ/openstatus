"use server";

import { z } from "zod";

import { and, eq } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import { sendEmail, SubscribeEmail } from "@openstatus/emails";

import { wait } from "@/lib/utils";

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
    throw new Error(fieldErrors?.email?.[0] || "Invalid form data");
  }

  const pageData = await db
    .select()
    .from(page)
    .where(eq(page.slug, validatedFields.data.slug))
    .get();

  if (!pageData) {
    throw new Error("Page not found");
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
    throw new Error("Already subscribed");
  }

  const token = crypto.randomUUID();

  await sendEmail({
    react: SubscribeEmail({
      domain: validatedFields.data.slug,
      token: token,
      page: pageData.title,
    }),
    from: "OpenStatus <notification@openstatus.dev>",
    to: [validatedFields.data.email],
    subject: "Verify your subscription",
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
}
