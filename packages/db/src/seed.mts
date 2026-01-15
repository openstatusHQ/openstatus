import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "../env.mjs";
import {
  incidentTable,
  maintenance,
  maintenancesToMonitors,
  monitor,
  monitorsToStatusReport,
  notification,
  notificationsToMonitors,
  page,
  pageComponent,
  privateLocation,
  privateLocationToMonitors,
  statusReport,
  statusReportUpdate,
  user,
  usersToWorkspaces,
  workspace,
} from "./schema";

async function main() {
  const db = drizzle(
    createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }),
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
        limits:
          '{"monitors":50,"synthetic-checks":150000,"periodicity":["30s","1m","5m","10m","30m","1h"],"multi-region":true,"max-regions":35,"data-retention":"24 months","status-pages":20,"maintenance":true,"status-subscribers":true,"custom-domain":true,"password-protection":true,"white-label":true,"notifications":true,"sms":true,"pagerduty":true,"notification-channels":50,"members":"Unlimited","audit-log":true,"regions":["ams","arn","atl","bog","bom","bos","cdg","den","dfw","ewr","eze","fra","gdl","gig","gru","hkg","iad","jnb","lax","lhr","mad","mia","nrt","ord","otp","phx","qro","scl","sea","sin","sjc","syd","waw","yul","yyz"]}',
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

  // Use the new pageComponent table (replaces deprecated monitorsToPages)
  await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: 1,
      type: "monitor",
      monitorId: 1,
      name: "OpenStatus",
      order: 0,
    })
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

  await db
    .insert(maintenancesToMonitors)
    .values([
      {
        maintenanceId: 1,
        monitorId: 1,
      },
    ])
    .onConflictDoNothing()
    .run();

  await db
    .insert(monitorsToStatusReport)
    .values([
      {
        monitorId: 1,
        statusReportId: 2,
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
    .insert(incidentTable)
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
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed");
  console.error(e);
  process.exit(1);
});
