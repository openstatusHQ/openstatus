import { expect, spyOn, test, afterEach } from "bun:test";
import { sendAlert, sendDegraded, sendRecovery } from "./index";
import { selectNotificationSchema } from "@openstatus/db/src/schema/notifications/validation";
import { describe } from "node:test";

describe("PagerDuty Notifications", () => {
  test('Send degraded', async () => {

    const spy = spyOn(global, 'fetch')

    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",

    }

    const a = { "id": 1, "name": "PagerDuty Notification", "provider": "pagerduty", "workspaceId": 1, "createdAt": new Date(), "updatedAt": new Date(), "data": "{\"pagerduty\":\"{\\\"integration_keys\\\":[{\\\"integration_key\\\":\\\"my_key\\\",\\\"name\\\":\\\"Default Service\\\",\\\"id\\\":\\\"ABCD\\\",\\\"type\\\":\\\"service\\\"}],\\\"account\\\":{\\\"subdomain\\\":\\\"test\\\",\\\"name\\\":\\\"test\\\"}}\"}" }


    const n = selectNotificationSchema.parse((a))
    await sendDegraded({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalled();
  })

  test('Send Recovered', async () => {

    const spy = spyOn(global, 'fetch')

    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",

    }

    const a = { "id": 1, "name": "PagerDuty Notification", "provider": "pagerduty", "workspaceId": 1, "createdAt": new Date(), "updatedAt": new Date(), "data": "{\"pagerduty\":\"{\\\"integration_keys\\\":[{\\\"integration_key\\\":\\\"my_key\\\",\\\"name\\\":\\\"Default Service\\\",\\\"id\\\":\\\"ABCD\\\",\\\"type\\\":\\\"service\\\"}],\\\"account\\\":{\\\"subdomain\\\":\\\"test\\\",\\\"name\\\":\\\"test\\\"}}\"}" }


    const n = selectNotificationSchema.parse((a))
    await sendRecovery({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalled();
  })

  test('Send Alert', async () => {

    const spy = spyOn(global, 'fetch')

    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",

    }
    const a = { "id": 1, "name": "PagerDuty Notification", "provider": "pagerduty", "workspaceId": 1, "createdAt": new Date(), "updatedAt": new Date(), "data": "{\"pagerduty\":\"{\\\"integration_keys\\\":[{\\\"integration_key\\\":\\\"my_key\\\",\\\"name\\\":\\\"Default Service\\\",\\\"id\\\":\\\"ABCD\\\",\\\"type\\\":\\\"service\\\"}],\\\"account\\\":{\\\"subdomain\\\":\\\"test\\\",\\\"name\\\":\\\"test\\\"}}\"}" }

    const n = selectNotificationSchema.parse((a))

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalled();
  })

})
