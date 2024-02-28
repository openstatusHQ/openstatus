import type { NextRequest } from "next/server";

import { and, gte, lte } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { user } from "@openstatus/db/src/schema";
import { FollowUpEmail, sendEmail } from "@openstatus/emails";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  console.log(authHeader);
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const date1 = new Date();
  date1.setDate(date1.getDate() - 3);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 2);
  const users = await db
    .select()
    .from(user)
    .where(and(gte(user.createdAt, date1), lte(user.createdAt, date2)))
    .all();
  for (const user of users) {
    if (user.email) {
      await sendEmail({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's it going with OpenStatus?",
        to: [user.email],
        react: FollowUpEmail(),
      });
    }
  }
  return Response.json({ success: true });
}
