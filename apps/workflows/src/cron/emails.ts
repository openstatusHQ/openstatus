import { and, eq, gte, inArray, lte } from "@openstatus/db";
import { db } from "@openstatus/db";
import {
  integration,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { env } from "../env";

const email = new EmailClient({ apiKey: env().RESEND_API_KEY });

export async function sendFollowUpEmails() {
  const date1 = new Date();
  date1.setDate(date1.getDate() - 2);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 1);

  const users = await db
    .select({
      email: user.email,
      workspaceId: usersToWorkspaces.workspaceId,
    })
    .from(user)
    .innerJoin(usersToWorkspaces, eq(user.id, usersToWorkspaces.userId))
    .where(and(gte(user.createdAt, date1), lte(user.createdAt, date2)))
    .all();

  console.log(`Found ${users.length} users to send follow ups.`);

  const workspaceIds = [
    ...new Set(users.map((u) => u.workspaceId).filter(Boolean)),
  ];

  const slackWorkspaceIds = new Set<number>();
  if (workspaceIds.length > 0) {
    const slackIntegrations = await db
      .select({ workspaceId: integration.workspaceId })
      .from(integration)
      .where(
        and(
          eq(integration.name, "slack-agent"),
          inArray(integration.workspaceId, workspaceIds),
        ),
      )
      .all();
    for (const row of slackIntegrations) {
      if (row.workspaceId) {
        slackWorkspaceIds.add(row.workspaceId);
      }
    }
  }

  const slackEmails: string[] = [];
  const noSlackEmails: string[] = [];

  for (const u of users) {
    if (!u.email || u.email.trim() === "") continue;
    const hasSlack = u.workspaceId
      ? slackWorkspaceIds.has(u.workspaceId)
      : false;
    if (hasSlack) {
      slackEmails.push(u.email);
    } else {
      noSlackEmails.push(u.email);
    }
  }

  const batchSize = 80;

  for (let i = 0; i < noSlackEmails.length; i += batchSize) {
    const batch = noSlackEmails.slice(i, i + batchSize);
    console.log(`Sending follow-up batch with ${batch.length} emails...`);
    try {
      await email.sendFollowUpBatched({ to: batch });
    } catch {
      console.error("Rate limit exceeded. Stopping further sends.");
      break;
    }
  }

  for (let i = 0; i < slackEmails.length; i += batchSize) {
    const batch = slackEmails.slice(i, i + batchSize);
    console.log(`Sending slack feedback batch with ${batch.length} emails...`);
    try {
      await email.sendSlackFeedbackBatched({ to: batch });
    } catch {
      console.error("Rate limit exceeded. Stopping further sends.");
      break;
    }
  }
}
