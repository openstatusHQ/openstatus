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
    .select({
      email: user.email,
    })
    .from(user)
    .where(and(gte(user.createdAt, date1), lte(user.createdAt, date2)))
    .all();

  console.log(`Found ${users.length} users to send follow ups.`);

  // Filter valid emails
  const validEmails = users
    .map((u) => u.email)
    .filter((email) => email !== null)
    //  I don't know why but I can't have both filter at the same time
    .filter((email) => typeof email === "string" && email.trim() !== "");

  // Chunk emails into batches of 80
  const batchSize = 80;
  for (let i = 0; i < validEmails.length; i += batchSize) {
    const batch = validEmails.slice(i, i + batchSize);
    console.log(`Sending batch with ${batch.length} emails...`);
    try {
      await email.sendFollowUpBatched({ to: batch });
    } catch {
      //Stop email send when rate limit error is faced in order to avoid wasteful API calls
      console.error("Rate limit exceeded. Stopping further sends.");
      break;
    }
  }
}
