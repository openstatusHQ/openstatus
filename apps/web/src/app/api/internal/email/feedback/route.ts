import { FeedbackEmail, sendEmail } from "@openstatus/emails";
import { listSignupEmails } from "@openstatus/services/user";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const date1 = new Date();
  date1.setDate(date1.getDate() - 15);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 14);

  const emails = await listSignupEmails({ from: date1, to: date2 });

  let sent = 0;
  for (const email of emails) {
    await sendEmail({
      from: "Thibault from openstatus <thibault@openstatus.dev>",
      subject: "One quick question",
      to: [email],
      react: FeedbackEmail(),
    });
    sent++;
  }

  return Response.json({ success: true, sent });
}
