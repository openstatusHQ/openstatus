## Motivation

We want to track every change made for the `incident` and `monitor`. Therefore,
it requires us to build some audit log / event sourcing foundation.

The `Event` is what the data type stored within [Tinybird](https://tinybird.co).
It has basic props that every event includes, as well as a `metadata` prop that
can be used to store additional informations.

```ts
export type Event = {
  /**
   * Unique identifier for the event.
   */
  id: string;

  /**
   * The actor that triggered the event.
   * @default { id: "", name: "system" }
   * @example { id: "1", name: "mxkaske" }
   */
  actor?: {
    id: string;
    name: string;
  };

  /**
   * The ressources affected by the action taken.
   * @example [{ id: "1", name: "monitor" }]
   */
  targets?: {
    id: string;
    name: string;
  }[];

  /**
   * The action that was triggered.
   * @example monitor.down | incident.create
   */
  action: string;

  /**
   * The timestamp of the event in milliseconds since epoch UTC.
   * @default Date.now()
   */
  timestamp?: number;

  /**
   * The version of the event. Should be incremented on each update.
   * @default 1
   */
  version?: number;

  /**
   * Metadata for the event. Defined via zod schema.
   */
  metadata?: unknown;
};
```

The objects are parsed and stored as string via
`schema.transform(val => JSON.stringify(val))` and transformed back into an
object before parsing via `z.preprocess(val => JSON.parse(val), schema)`.

## Example

```ts
const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });

const auditLog = new AuditLog({ tb });

await auditLog.publishAuditLog({
  id: "monitor:1",
  action: "monitor.down",
  targets: [{ id: "1", type: "monitor" }], // not mandatory, but could be useful later on
  metadata: { region: "gru", statusCode: 400, message: "timeout" },
});

await auditLog.getAuditLog({ event_id: "monitor:1" });
```

## Inspiration

- WorkOS [Audit Logs](https://workos.com/docs/audit-logs)

## Tinybird

Push the pipe and datasource to tinybird:

```
tb push datasources/audit_log.datasource
tb push pipes/endpoint_audit_log.pipe
```

---

### Possible extention

> TODO: Remove `Nullable` from `targets` to better index and query it.
