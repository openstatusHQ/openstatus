import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "../env.mjs";
import {
  externalService,
  incident,
  incidentEvent,
  monitorIncidentTable,
  maintenance,
  maintenanceUpdate,
  maintenancesToPageComponents,
  monitor,
  notification,
  notificationsToMonitors,
  page,
  pageComponent,
  privateLocation,
  privateLocationToMonitors,
  session,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
  user,
  usersToWorkspaces,
  workspace,
} from "./schema";
import { externalServicesSeed } from "./seed/external-services";
import { TEAM_WORKSPACE_LIMITS } from "./seed/limits";

async function main() {
  if (
    !env.DATABASE_URL.includes("localhost") &&
    !env.DATABASE_URL.includes("127.0.0.1")
  ) {
    throw new Error(
      `Refusing to wipe non-local database: DATABASE_URL=${env.DATABASE_URL}`,
    );
  }

  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  // Fresh slate: wipe every table so re-seeding is idempotent and tests never
  // inherit residue from a previous run. `defer_foreign_keys` lets us delete in
  // any order within the transaction (all tables end empty, so FKs hold at commit).
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
  );
  await client.batch(
    [
      "PRAGMA defer_foreign_keys=ON",
      ...tables.rows.map((row) => `DELETE FROM "${row.name}"`),
    ],
    "write",
  );

  console.log("Seeding database ");
  await db
    .insert(workspace)
    .values([
      {
        id: 1,
        slug: "love-openstatus",
        stripeId: "stripeId1",
        name: "test",
        subscriptionId: "subscriptionId",
        plan: "team",
        endsAt: null,
        paidUntil: null,
        limits: TEAM_WORKSPACE_LIMITS,
      },
      {
        id: 2,
        slug: "test2",
        stripeId: "stripeId2",
        name: "test2",
        subscriptionId: "subscriptionId2",
        plan: "free",
        endsAt: null,
        paidUntil: null,
      },
      {
        id: 3,
        slug: "test3",
        stripeId: "stripeId3",
        name: "test3",
        subscriptionId: "subscriptionId3",
        plan: "team",
        endsAt: null,
        paidUntil: null,
      },
    ])
    .onConflictDoNothing()
    .run();

  await db
    .insert(monitor)
    .values([
      {
        id: 1,
        workspaceId: 1,
        active: true,
        url: "https://www.openstatus.dev",
        name: "OpenStatus",
        description: "OpenStatus website",
        method: "POST",
        periodicity: "1m",
        regions: "ams",
        headers: '[{"key":"key", "value":"value"}]',
        body: '{"hello":"world"}',
      },
      {
        id: 2,
        active: false,
        workspaceId: 1,
        periodicity: "10m",
        url: "https://www.google.com",
        method: "GET",
        regions: "gru",
        public: true,
      },
      {
        id: 3,
        workspaceId: 1,
        active: true,
        url: "https://www.openstatus.dev",
        name: "OpenStatus",
        description: "OpenStatus website",
        method: "GET",
        periodicity: "1m",
        regions: "ams",
        headers: '[{"key":"key", "value":"value"}]',
        body: '{"hello":"world"}',
      },
      {
        id: 4,
        active: true,
        workspaceId: 1,
        periodicity: "10m",
        url: "https://www.google.com",
        method: "GET",
        regions: "gru",
        public: true,
        otelEndpoint: "https://otel.com:4337",
        otelHeaders: '[{"key":"Authorization","value":"Basic"}]',
      },
      {
        id: 5,
        active: true,
        workspaceId: 3,
        periodicity: "10m",
        url: "https://openstat.us",
        method: "GET",
        regions: "ams",
        public: true,
      },
    ])
    .onConflictDoNothing()
    .run();

  await db
    .insert(page)
    .values({
      id: 1,
      workspaceId: 1,
      title: "Acme Inc.",
      description: "Get informed about our services.",
      icon: "https://www.openstatus.dev/favicon.ico",
      slug: "status",
      customDomain: "",
      published: true,
    })
    .onConflictDoNothing()
    .run();

  await db
    .insert(page)
    .values({
      id: 2,
      workspaceId: 1,
      title: "Acme Inc.",
      description: "Get informed about our services.",
      icon: "https://www.openstatus.dev/favicon.ico",
      slug: "acme",
      customDomain: "status.acme.com",
      published: true,
    })
    .onConflictDoNothing()
    .run();

  await db
    .insert(user)
    .values({
      id: 1,
      tenantId: "1",
      firstName: "Speed",
      lastName: "Matters",
      email: "ping@openstatus.dev",
      photoUrl: "",
    })
    .onConflictDoNothing()
    .run();
  await db
    .insert(usersToWorkspaces)
    .values({ workspaceId: 1, userId: 1 })
    .onConflictDoNothing()
    .run();

  // Fixed tokens so the dashboard and scripts/screenshot.mjs log in without a
  // magic link; main() refuses non-local databases.
  await db
    .insert(user)
    .values([
      {
        id: 2,
        tenantId: "2",
        name: "Maximilian Kaske",
        firstName: "Maximilian",
        lastName: "Kaske",
        email: "max@openstatus.dev",
        emailVerified: new Date(),
        photoUrl: "https://github.com/mxkaske.png",
      },
      {
        id: 3,
        tenantId: "3",
        name: "Thibault Le Ouay Ducasse",
        firstName: "Thibault",
        lastName: "Le Ouay Ducasse",
        email: "thibault@openstatus.dev",
        emailVerified: new Date(),
        photoUrl: "https://github.com/thibaultleouay.png",
      },
    ])
    .onConflictDoNothing()
    .run();
  await db
    .insert(usersToWorkspaces)
    .values([
      { workspaceId: 1, userId: 2, role: "owner" },
      { workspaceId: 1, userId: 3, role: "admin" },
      { workspaceId: 2, userId: 2, role: "owner" },
      { workspaceId: 3, userId: 3, role: "owner" },
    ])
    .onConflictDoNothing()
    .run();
  const farFuture = new Date("2099-01-01T00:00:00Z");
  await db
    .insert(session)
    .values([
      { sessionToken: "seed-session-max", userId: 2, expires: farFuture },
      { sessionToken: "seed-session-thibault", userId: 3, expires: farFuture },
    ])
    .onConflictDoNothing()
    .run();

  // Page Components - representing monitors on the status page
  await db
    .insert(pageComponent)
    .values([
      {
        id: 1,
        workspaceId: 1,
        pageId: 1,
        type: "monitor",
        monitorId: 1,
        name: "OpenStatus Monitor",
        description: "Main website monitoring",
        order: 0,
      },
      {
        id: 2,
        workspaceId: 1,
        pageId: 1,
        type: "monitor",
        monitorId: 2,
        name: "Google Monitor",
        description: "Google.com monitoring",
        order: 1,
      },
    ])
    .onConflictDoNothing()
    .run();

  await db
    .insert(notification)
    .values({
      id: 1,
      provider: "email",
      name: "sample test notification",
      data: '{"email":"ping@openstatus.dev"}',
      workspaceId: 1,
    })
    .onConflictDoNothing()
    .run();

  await db
    .insert(notificationsToMonitors)
    .values({ monitorId: 1, notificationId: 1 })
    .onConflictDoNothing()
    .run();

  // Status Report 1 - Resolved incident from 7 days ago
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoPlus30Min = new Date(
    sevenDaysAgo.getTime() + 30 * 60 * 1000,
  );
  const sevenDaysAgoPlus90Min = new Date(
    sevenDaysAgo.getTime() + 90 * 60 * 1000,
  );
  const sevenDaysAgoPlus120Min = new Date(
    sevenDaysAgo.getTime() + 120 * 60 * 1000,
  );

  await db
    .insert(statusReport)
    .values({
      id: 1,
      workspaceId: 1,
      pageId: 1,
      title: "API Gateway Degraded Performance",
      status: "resolved",
      updatedAt: sevenDaysAgoPlus120Min,
    })
    .onConflictDoNothing()
    .run();

  await db
    .insert(statusReportUpdate)
    .values([
      {
        id: 1,
        statusReportId: 1,
        status: "investigating",
        message:
          "We are investigating reports of slow API response times affecting some customers.",
        date: sevenDaysAgo,
      },
      {
        id: 2,
        statusReportId: 1,
        status: "identified",
        message:
          "We have identified the issue as a database connection pool exhaustion and are working on a fix.",
        date: sevenDaysAgoPlus30Min,
      },
      {
        id: 3,
        statusReportId: 1,
        status: "monitoring",
        message:
          "A fix has been deployed and we are monitoring the system. Response times are returning to normal.",
        date: sevenDaysAgoPlus90Min,
      },
      {
        id: 4,
        statusReportId: 1,
        status: "resolved",
        message:
          "All systems are operating normally. The issue has been fully resolved.",
        date: sevenDaysAgoPlus120Min,
      },
    ])
    .onConflictDoNothing()
    .run();

  // Status Report 2 - Ongoing incident from 2 hours ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

  await db
    .insert(statusReport)
    .values({
      id: 2,
      workspaceId: 1,
      pageId: 1,
      title: "Increased Error Rates on Monitoring Checks",
      status: "resolved",
      updatedAt: oneHourAgo,
    })
    .onConflictDoNothing()
    .run();

  await db
    .insert(statusReportUpdate)
    .values([
      {
        id: 5,
        statusReportId: 2,
        status: "investigating",
        message:
          "We are seeing elevated error rates on some monitoring checks and are investigating the root cause.",
        date: twoHoursAgo,
      },
      {
        id: 6,
        statusReportId: 2,
        status: "monitoring",
        message:
          "We have applied a fix and are monitoring the situation. Error rates are decreasing.",
        date: oneHourAgo,
      },
      {
        id: 7,
        statusReportId: 2,
        status: "resolved",
        message:
          "Everything is under control, we continue to monitor the situation.",
        date: twentyMinutesAgo,
      },
    ])
    .onConflictDoNothing()
    .run();

  // Maintenance windows spread across 30 days
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const twentyDaysAgoPlus2Hours = new Date(
    twentyDaysAgo.getTime() + 2 * 60 * 60 * 1000,
  );

  const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const fiveDaysFromNowPlus4Hours = new Date(
    fiveDaysFromNow.getTime() + 4 * 60 * 60 * 1000,
  );

  await db
    .insert(maintenance)
    .values([
      {
        id: 1,
        workspaceId: 1,
        title: "Database Migration and Optimization",
        message:
          "We will be performing database maintenance to improve performance. Some queries may be slower during this window.",
        from: twentyDaysAgo,
        to: twentyDaysAgoPlus2Hours,
        pageId: 1,
      },
      {
        id: 2,
        workspaceId: 1,
        title: "Infrastructure Upgrade",
        message:
          "We will be upgrading our monitoring infrastructure to the latest version. Expect brief interruptions in data collection.",
        from: fiveDaysFromNow,
        to: fiveDaysFromNowPlus4Hours,
        pageId: 1,
      },
    ])
    .onConflictDoNothing()
    .run();

  // the first update is the announcement; later ones are the timeline
  await db
    .insert(maintenanceUpdate)
    .values([
      {
        id: 1,
        maintenanceId: 1,
        message:
          "We will be performing database maintenance to improve performance. Some queries may be slower during this window.",
        date: twentyDaysAgo,
      },
      {
        id: 2,
        maintenanceId: 1,
        message: "Maintenance completed. All queries are back to full speed.",
        date: twentyDaysAgoPlus2Hours,
      },
      {
        id: 3,
        maintenanceId: 2,
        message:
          "We will be upgrading our monitoring infrastructure to the latest version. Expect brief interruptions in data collection.",
        date: new Date(),
      },
    ])
    .onConflictDoNothing()
    .run();

  // Link status reports to page components
  await db
    .insert(statusReportsToPageComponents)
    .values([
      {
        statusReportId: 1,
        pageComponentId: 1,
      },
      {
        statusReportId: 2,
        pageComponentId: 1,
      },
    ])
    .onConflictDoNothing()
    .run();

  // Link maintenances to page components
  await db
    .insert(maintenancesToPageComponents)
    .values([
      {
        maintenanceId: 1,
        pageComponentId: 1,
      },
    ])
    .onConflictDoNothing()
    .run();

  // Incidents - realistic past incidents that were resolved
  const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgoPlus2Hours = new Date(
    fifteenDaysAgo.getTime() + 2 * 60 * 60 * 1000,
  );

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const threeDaysAgoPlus20Min = new Date(
    threeDaysAgo.getTime() + 20 * 60 * 1000,
  );

  await db
    .insert(monitorIncidentTable)
    .values([
      {
        id: 1,
        workspaceId: 1,
        monitorId: 1,
        createdAt: fifteenDaysAgo,
        startedAt: fifteenDaysAgo,
        acknowledgedAt: new Date(fifteenDaysAgo.getTime() + 5 * 60 * 1000),
        resolvedAt: fifteenDaysAgoPlus2Hours,
      },
      {
        id: 2,
        workspaceId: 1,
        monitorId: 1,
        createdAt: threeDaysAgo,
        startedAt: threeDaysAgo,
        acknowledgedAt: new Date(threeDaysAgo.getTime() + 2 * 60 * 1000),
        resolvedAt: threeDaysAgoPlus20Min,
      },
    ])
    .onConflictDoNothing()
    .run();

  await db
    .insert(incident)
    .values({
      id: 1,
      workspaceId: 1,
      title: "Elevated API error rates",
      severity: "major",
      status: "mitigated",
      summary: "Increased 5xx responses on the public API.",
      commanderId: 2,
      declaredBy: 3,
      declaredAt: twoHoursAgo,
      startedAt: new Date(twoHoursAgo.getTime() - 10 * 60 * 1000),
      mitigatedAt: new Date(twoHoursAgo.getTime() + 45 * 60 * 1000),
      statusReportId: 2,
    })
    .onConflictDoNothing()
    .run();
  // Messages follow the service formats so the timeline parses them into
  // sentences; one row of every kind the incident page renders.
  const minutesAfterDeclare = (m: number) =>
    new Date(twoHoursAgo.getTime() + m * 60 * 1000);
  await db
    .insert(incidentEvent)
    .values([
      {
        incidentId: 1,
        type: "declared",
        message: "Declared as major: Elevated API error rates",
        createdBy: 3,
        createdAt: twoHoursAgo,
      },
      {
        incidentId: 1,
        type: "slack_channel_bound",
        message: "Slack channel <#C0C7Y4CG6F2> bound",
        createdBy: null,
        createdAt: minutesAfterDeclare(1),
      },
      {
        incidentId: 1,
        type: "status_report_linked",
        message: "Linked status report #2",
        createdBy: 3,
        createdAt: minutesAfterDeclare(2),
      },
      {
        incidentId: 1,
        type: "note",
        message:
          "Rolling back the latest API deploy, 5xx started right after it went out.",
        source: "slack",
        sourceRef:
          "https://openstatus.slack.com/archives/C0C7Y4CG6F2/p1700000000000100",
        createdBy: 2,
        createdAt: minutesAfterDeclare(12),
      },
      {
        incidentId: 1,
        type: "commander_changed",
        message: "Commander set to Maximilian Kaske",
        source: "slack",
        createdBy: 3,
        createdAt: minutesAfterDeclare(15),
      },
      {
        incidentId: 1,
        type: "status_changed",
        message:
          "Status changed from open to mitigated\n\nRollback done, error rate back to baseline.",
        createdBy: 2,
        createdAt: minutesAfterDeclare(45),
      },
      {
        incidentId: 1,
        type: "note",
        message:
          "Baseline for 30 minutes now. Keeping the incident open until p99 latency recovers too.",
        createdBy: 2,
        createdAt: minutesAfterDeclare(75),
      },
      // Unbound again so the timeline and the incident's (empty) Slack binding agree.
      {
        incidentId: 1,
        type: "slack_channel_unbound",
        message: "Slack channel <#C0C7Y4CG6F2> unbound",
        createdBy: null,
        createdAt: minutesAfterDeclare(80),
      },
    ])
    .run();

  await db
    .insert(privateLocation)
    .values({
      id: 1,
      name: "My Home",
      token: "my-secret-key",
      workspaceId: 3,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .run();
  await db
    .insert(privateLocationToMonitors)
    .values({
      privateLocationId: 1,
      monitorId: 5,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .run();

  await db
    .insert(externalService)
    .values(externalServicesSeed)
    .onConflictDoNothing()
    .run();

  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed");
  console.error(e);
  process.exit(1);
});
