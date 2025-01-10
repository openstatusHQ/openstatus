import { and, db, eq, isNull, lte, max, ne, or, schema } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

export async function LaunchMonitorWorkflow() {
  const threeMonthAgo = new Date().setMonth(new Date().getMonth() - 3);

  const date = new Date(threeMonthAgo);

  // Only free users monitors are paused
  // We don't need to handle multi users per workspace because free workspaces only have one user
  const users = await db
    .select({
      userId: schema.user.id,
      email: schema.user.email,
      lastConnection: schema.user.updatedAt,
      workspaceId: schema.workspace.id,
    })
    .from(user)
    .innerJoin(
      schema.usersToWorkspaces,
      eq(schema.user.id, schema.usersToWorkspaces.userId),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.usersToWorkspaces.workspaceId, schema.workspace.id),
    )
    .where(
      and(
        or(lte(schema.user.updatedAt, date), isNull(schema.user.updatedAt)),
        or(isNull(schema.workspace.plan), ne(schema.workspace.plan, "free")),
      ),
    );

  // iterate over users
  for (const user of users) {
    // check if user has some running monitors

    // if they have check if the user is in the workflow
    //
    // If user not in workflow
    // Start workflow -> create task with monitors/start
    // add users to workflow Redis
    console.log(`user worflow started for ${user.userId}`);
  }
}
