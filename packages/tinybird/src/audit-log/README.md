### Motivation

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
   * @example [{ id: "1", name: "organization" }]
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

### Example

```ts
const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });
const metadataSchema = z.object({ region: z.string() });
const name = "audit_log__v0";

const auditLog = new AuditLog({ tb, name, metadataSchema });

await auditLog.publishAuditLog({
  id: "monitor:1",
  action: "monitor.down",
  metadata: { region: "gru" },
});

await auditLog.getAuditLog({ event_id: "monitor:1" });
```

### Inspiration

- WorkOS [Audit Logs](https://workos.com/docs/audit-logs)
