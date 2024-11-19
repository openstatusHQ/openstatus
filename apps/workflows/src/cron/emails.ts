import { and, gte, lte } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { user } from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { env } from "../env";

const email = new EmailClient({ apiKey: env().RESEND_API_KEY });

export async function sendFollowUpEmails() {
  // Get users created 2-3 days ago
  const date1 = new Date();
  date1.setDate(date1.getDate() - 3);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 2);

  const users = await db
    .select()
    .from(user)
    .where(and(gte(user.createdAt, date1), lte(user.createdAt, date2)))
    .all();

  console.log(`Found ${users.length} users to send follow ups.`);

  for (const user of users) {
    if (user.email) {
      await email.sendFollowUp({ to: user.email });
    }
  }
}
