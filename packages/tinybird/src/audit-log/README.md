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
   * Metadata for the event.
   */
  metadata?: Record<string, unknown>;
};
```

The objects are parsed and stored as string via
`schema.transform(val => JSON.stringify(val))` and transformed back into an
object before parsing via `z.preprocess(val => JSON.parse(val), schema)`.

### Improvements

Right now, the `metadata` object is not very typesafe. It would be great if we
could make `zod` generics work and extend/merge the base schema such that we get
the correct metadata types after validation.

Something like:

```ts
const schemaExtender = <T extends z.ZodRawShape>(p: z.ZodObject<T>) =>
  z.object({ foo: z.boolean() }).merge(p);
const schema = schemaExtender(z.object({ bar: z.number() }));
type Schema = z.infer<typeof schema>;
// ^? { foo: boolean; bar: number; }
```

### Inspiration

- WorkOS [Audit Logs](https://workos.com/docs/audit-logs)
