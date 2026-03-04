import type { NextRequest } from "next/server";

import { and, count, eq, gte, inArray, lte } from "@openstatus/db";
import { db } from "@openstatus/db/src/db";
import { invitation, user, usersToWorkspaces } from "@openstatus/db/src/schema";
import { TeamInviteReminderEmail, sendEmail } from "@openstatus/emails";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const date1 = new Date();
  date1.setDate(date1.getDate() - 6);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 5);

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

  if (workspaceIds.length === 0) {
    return Response.json({ success: true, sent: 0 });
  }

  const workspaceMemberCounts = await db
    .select({
      workspaceId: usersToWorkspaces.workspaceId,
      memberCount: count(usersToWorkspaces.userId),
    })
    .from(usersToWorkspaces)
    .where(inArray(usersToWorkspaces.workspaceId, workspaceIds))
    .groupBy(usersToWorkspaces.workspaceId)
    .all();

  const workspacesWithInvitations = await db
    .select({ workspaceId: invitation.workspaceId })
    .from(invitation)
    .where(inArray(invitation.workspaceId, workspaceIds))
    .groupBy(invitation.workspaceId)
    .all();

  const hasTeamActivity = new Set<number>();

  for (const row of workspaceMemberCounts) {
    if (row.memberCount > 1) {
      hasTeamActivity.add(row.workspaceId);
    }
  }
  for (const row of workspacesWithInvitations) {
    hasTeamActivity.add(row.workspaceId);
  }

  let sent = 0;
  for (const u of users) {
    if (!u.email) continue;
    if (u.workspaceId && hasTeamActivity.has(u.workspaceId)) continue;

    await sendEmail({
      from: "Thibault from OpenStatus <thibault@openstatus.dev>",
      subject: "Incidents are a team sport",
      to: [u.email],
      react: TeamInviteReminderEmail(),
    });
    sent++;
  }

  return Response.json({ success: true, sent });
}
