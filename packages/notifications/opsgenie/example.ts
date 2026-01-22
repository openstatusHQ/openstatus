/**
 * OpsGenie Notification Examples
 *
 * This script demonstrates how to send all types of alerts to OpsGenie
 */

import { sendAlert, sendDegraded, sendRecovery } from "./src/index";

// Mock monitor data
const mockMonitor = {
  id: "monitor-1",
  name: "API Health Check",
  url: "https://api.example.com/health",
  jobType: "http" as const,
  periodicity: "5m" as const,
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  region: "iad",
};

// Mock notification data with your OpsGenie API key
const mockNotification = {
  id: 1,
  name: "OpsGenie Notification",
  provider: "opsgenie" as const,
  workspaceId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Replace with your OpsGenie API key and region
  data: '{"opsgenie":{"apiKey":"your-api-key","region":"us"}}',
  // For EU region: data: '{"opsgenie":{"apiKey":"your-api-key","region":"eu"}}'
};

// Mock incident data
const mockIncident = {
  id: "incident-1",
  monitorId: "monitor-1",
  startedAt: new Date(Date.now() - 300000), // 5 minutes ago
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: new Date(Date.now() - 300000),
  updatedAt: new Date(),
};

async function runExamples() {
  const cronTimestamp = Date.now();

  console.log("🚨 Example 1: Sending Alert (Monitor Down)");
  try {
    await sendAlert({
      // @ts-expect-error - simplified mock
      monitor: mockMonitor,
      // @ts-expect-error - simplified mock
      notification: mockNotification,
      statusCode: 500,
      message: "Internal Server Error",
      // @ts-expect-error - simplified mock
      incident: mockIncident,
      cronTimestamp,
      latency: 5000,
      region: "iad",
    });
    console.log("✅ Alert sent successfully\n");
  } catch (error) {
    console.error("❌ Failed to send alert:", error, "\n");
  }

  console.log("⚠️  Example 2: Sending Degraded Alert");
  try {
    await sendDegraded({
      // @ts-expect-error - simplified mock
      monitor: mockMonitor,
      // @ts-expect-error - simplified mock
      notification: mockNotification,
      statusCode: 503,
      message: "Service Unavailable",
      // @ts-expect-error - simplified mock
      incident: mockIncident,
      cronTimestamp,
      latency: 3000,
      region: "iad",
    });
    console.log("✅ Degraded alert sent successfully\n");
  } catch (error) {
    console.error("❌ Failed to send degraded alert:", error, "\n");
  }

  console.log("✅ Example 3: Sending Recovery (Monitor Up)");
  try {
    await sendRecovery({
      // @ts-expect-error - simplified mock
      monitor: mockMonitor,
      // @ts-expect-error - simplified mock
      notification: mockNotification,
      statusCode: 200,
      message: "OK",
      // @ts-expect-error - simplified mock
      incident: {
        ...mockIncident,
        resolvedAt: new Date(),
      },
      cronTimestamp,
      latency: 150,
      region: "iad",
    });
    console.log("✅ Recovery sent successfully\n");
  } catch (error) {
    console.error("❌ Failed to send recovery:", error, "\n");
  }
}

// Run examples
runExamples();
