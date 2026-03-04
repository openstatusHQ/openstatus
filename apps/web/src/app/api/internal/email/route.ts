import type { NextRequest } from "next/server";

import { and, eq, gte, inArray, lte } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import {
  integration,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import {
  FollowUpEmail,
  SlackFeedbackEmail,
  sendEmail,
} from "@openstatus/emails";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  console.log(authHeader);
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

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

  for (const u of users) {
    if (!u.email) continue;
    const hasSlack = u.workspaceId
      ? slackWorkspaceIds.has(u.workspaceId)
      : false;

    await sendEmail({
      from: "Thibault from OpenStatus <thibault@openstatus.dev>",
      subject: hasSlack
        ? "How's the Slack app working for you?"
        : "Manage incidents from Slack",
      to: [u.email],
      react: hasSlack ? SlackFeedbackEmail() : FollowUpEmail(),
    });
  }
  return Response.json({ success: true });
}
