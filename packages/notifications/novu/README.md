# @openstatus/notification-novu

Sends OpenStatus monitor notifications to [Novu](https://novu.co) by triggering
a Novu workflow. OpenStatus calls the Novu **Trigger Event** API on alert,
degraded, and recovery transitions; the customer's Novu workflow then fans the
event out to any channel Novu supports (email, SMS, push, chat, in-app).

## Configuration

Users provide, from their Novu dashboard:

- **API key** — a Novu **secret** key (`Settings → API Keys`). Sent as
  `Authorization: ApiKey <key>`.
- **Workflow identifier** — the workflow to trigger (`name` in the event body).
- **Subscriber id** — the Novu subscriber that receives the notification.
- **Region** — `us` (`api.novu.co`) or `eu` (`eu.api.novu.co`).

## Payload

Each trigger sends this `payload`, available to the Novu workflow's templates:

| field         | description                                    |
| ------------- | ---------------------------------------------- |
| `type`        | `alert` \| `degraded` \| `recovery`            |
| `status`      | `down` \| `degraded` \| `recovered`            |
| `monitorId`   | monitor id                                     |
| `monitorName` | monitor name                                   |
| `monitorUrl`  | monitored URL                                  |
| `statusCode`  | last observed HTTP status code (if any)        |
| `message`     | error/context message (if any)                 |
| `regions`     | regions that observed the transition           |
| `latency`     | observed latency in ms (if any)                |
| `cronTimestamp` | check timestamp                              |

An `Idempotency-Key` (`<monitorId>-<cronTimestamp>-<type>`) is sent with every
trigger so retried triggers for the same state transition can be de-duplicated.
Note: API-level idempotency may need to be enabled for your Novu organization
for this to take effect.
