/**
 * Webhook Notification Examples
 *
 * This script demonstrates how to send all types of alerts via custom webhooks
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

// Mock notification data with your webhook endpoint
const mockNotification = {
  id: 1,
  name: "Webhook Notification",
  provider: "webhook" as const,
  workspaceId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Replace with your webhook URL and optional headers
  data: '{"webhook":{"endpoint":"https://your-webhook-url.com/endpoint"}}',
  // With custom headers:
  // data: '{"webhook":{"endpoint":"https://your-webhook-url.com/endpoint","headers":[{"key":"Authorization","value":"Bearer your-token"}]}}',
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
  console.log("Webhook will receive JSON payload with status: 'error'");
  try {
    await sendAlert({
      // @ts-expect-error - simplified mock
      monitor: mockMonitor,
      // @ts-expect-error - simplified mock
      notification: mockNotification,
      statusCode: 500,
      message: "Internal Server Error",
      cronTimestamp,
      latency: 5000,
      region: "iad",
    });
    console.log("✅ Alert sent successfully\n");
  } catch (error) {
    console.error("❌ Failed to send alert:", error, "\n");
  }

  console.log("⚠️  Example 2: Sending Degraded Alert");
  console.log("Webhook will receive JSON payload with status: 'degraded'");
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
  console.log("Webhook will receive JSON payload with status: 'recovered'");
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

  console.log("\nExpected webhook payload structure:");
  console.log(`{
  "monitor": {
    "id": "monitor-1",
    "name": "API Health Check",
    "url": "https://api.example.com/health",
    ...
  },
  "cronTimestamp": 1234567890,
  "status": "error" | "degraded" | "recovered",
  "statusCode": 500,
  "latency": 5000,
  "errorMessage": "Internal Server Error"
}`);
}

// Run examples
runExamples();
