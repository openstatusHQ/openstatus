import type { NextRequest } from "next/server";

import { and, gte, lte } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { user } from "@openstatus/db/src/schema";
import { FeedbackEmail, sendEmail } from "@openstatus/emails";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const date1 = new Date();
  date1.setDate(date1.getDate() - 15);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 14);

  const users = await db
    .select({ email: user.email })
    .from(user)
    .where(and(gte(user.createdAt, date1), lte(user.createdAt, date2)))
    .all();

  let sent = 0;
  for (const u of users) {
    if (!u.email || u.email.trim() === "") continue;

    await sendEmail({
      from: "Thibault from OpenStatus <thibault@openstatus.dev>",
      subject: "One quick question",
      to: [u.email],
      react: FeedbackEmail(),
    });
    sent++;
  }

  return Response.json({ success: true, sent });
}
