import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { db, eq, sql } from "@openstatus/db";
import {
  flyRegions,
  METHODS,
  monitor,
  periodicity,
} from "@openstatus/db/src/schema/monitor";

import type { Variables } from "./index";
import { ErrorSchema } from "./shared";

const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the monitor",
      example: "1",
    }),
});

export const periodicityEnum = z.enum(periodicity);
export const regionEnum = z
  .enum(flyRegions)
  .or(z.literal(""))
  .transform((val) => (val === "" ? "" : val));

const MonitorSchema = z
  .object({
    id: z.number().openapi({
      example: 123,
      description: "The id of the monitor",
    }),
    periodicity: periodicityEnum.openapi({
      example: "1m",
      description: "How often the monitor should run",
    }),
    url: z.string().url().openapi({
      example: "https://www.documenso.co",
      description: "The url to monitor",
    }),
    regions: regionEnum.openapi({
      example: "ams",
      description: "The regions to use",
    }),
    name: z
      .string()
      .openapi({
        example: "Documenso",
        description: "The name of the monitor",
      })
      .nullable(),
    description: z
      .string()
      .openapi({
        example: "Documenso website",
        description: "The description of your monitor",
      })
      .nullable(),
    method: z.enum(METHODS).default("GET").openapi({ example: "GET" }),
    body: z
      .preprocess((val) => {
        return String(val);
      }, z.string())
      .default("")
      .openapi({
        example: "Hello World",
        description: "The body",
      }),
    headers: z
      .preprocess(
        (val) => {
          if (String(val).length > 0) {
            return JSON.parse(String(val));
          } else {
            return [];
          }
        },
        z.array(z.object({ key: z.string(), value: z.string() })).default([]),
      )
      .openapi({
        description: "The headers of your request",
        example: [{ key: "x-apikey", value: "supersecrettoken" }],
      }),
    active: z
      .boolean()
      .default(false)
      .openapi({ description: "If the monitor is active" }),
  })
  .openapi({
    description: "The monitor",
    required: ["periodicity", "url", "regions", "method"],
  });

const monitorInput = z
  .object({
    periodicity: periodicityEnum.openapi({
      example: "1m",
      description: "How often the monitor should run",
    }),
    url: z.string().url().openapi({
      example: "https://www.documenso.co",
      description: "The url to monitor",
    }),
    regions: regionEnum.openapi({
      example: "ams",
      description: "The regions to use",
    }),
    name: z.string().openapi({
      example: "Documenso",
      description: "The name of the monitor",
    }),
    description: z.string().openapi({
      example: "Documenso website",
      description: "The description of your monitor",
    }),
    method: z.enum(METHODS).default("GET").openapi({ example: "GET" }),
    body: z.string().openapi({
      example: "Hello World",
      description: "The body",
    }),
    active: z.boolean().default(false).openapi({
      description: "If the monitor is active",
    }),
    headers: z
      .preprocess(
        (val) => {
          if (!!val) {
            return val;
          } else {
            return [];
          }
        },
        z.array(z.object({ key: z.string(), value: z.string() })).default([]),
      )
      .openapi({
        description: "The headers of your request",
        example: [{ key: "x-apikey", value: "supersecrettoken" }],
      }),
  })
  .openapi({
    required: ["periodicity", "url", "regions", "method"],
  });

const monitorApi = new OpenAPIHono<{ Variables: Variables }>();

const getAllRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(MonitorSchema),
        },
      },
      description: "Get the monitor",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Not found",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});
monitorApi.openapi(getAllRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));

  const _monitor = await db
    .select()
    .from(monitor)
    .where(eq(monitor.workspaceId, workspaceId))
    .all();

  if (!_monitor) return c.jsonT({ code: 404, message: "Not Found" });

  const data = z.array(MonitorSchema).parse(_monitor);

  return c.jsonT(data);
});

const getRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "Get the monitor",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

monitorApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const monitorId = Number(id);
  console.log({ monitorId, workspaceId });
  const _monitor = await db
    .select()
    .from(monitor)
    .where(eq(monitor.id, monitorId))
    .get();

  if (!_monitor) return c.jsonT({ code: 404, message: "Not Found" });

  if (workspaceId !== _monitor.workspaceId)
    return c.jsonT({ code: 401, message: "Unauthorized" });

  const data = MonitorSchema.parse(_monitor);

  return c.jsonT(data);
});

const postRoute = createRoute({
  method: "post",
  tags: ["monitor"],
  path: "/",
  request: {
    body: {
      description: "The monitor to create",
      content: {
        "application/json": {
          schema: monitorInput,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "Create a monitor",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
    403: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

monitorApi.openapi(postRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const workspacePlan = c.get("workspacePlan");
  console.log({ workspaceId });
  const input = c.req.valid("json");

  const count = (
    await db.select({ count: sql<number>`count(*)` }).from(monitor)
  )[0].count;

  if (count >= workspacePlan.limits.monitors)
    return c.jsonT({ code: 403, message: "Forbidden" });

  if (!workspacePlan.limits.periodicity.includes(input.periodicity))
    return c.jsonT({ code: 403, message: "Forbidden" });

  const { headers, ...rest } = input;
  const _newMonitor = await db
    .insert(monitor)
    .values({
      ...rest,
      workspaceId: workspaceId,
      headers: input.headers ? JSON.stringify(input.headers) : undefined,
    })
    .returning()
    .get();

  const data = MonitorSchema.parse(_newMonitor);

  return c.jsonT(data);
});

const putRoute = createRoute({
  method: "put",
  tags: ["monitor"],
  path: "/:id",
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: monitorInput,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "Update a monitor",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

monitorApi.openapi(putRoute, async (c) => {
  const input = c.req.valid("json");
  const workspaceId = Number(c.get("workspaceId"));
  const workspacePlan = c.get("workspacePlan");
  const { id } = c.req.valid("param");

  if (!id) return c.jsonT({ code: 400, message: "Bad Request" });

  if (!workspacePlan.limits.periodicity.includes(input.periodicity))
    return c.jsonT({ code: 403, message: "Forbidden" });

  const _monitor = await db
    .select()
    .from(monitor)
    .where(eq(monitor.id, Number(id)))
    .get();

  if (!_monitor) return c.jsonT({ code: 404, message: "Not Found" });

  if (workspaceId !== _monitor.workspaceId)
    return c.jsonT({ code: 401, message: "Unauthorized" });

  const { headers, ...rest } = input;
  const _newMonitor = await db
    .update(monitor)
    .set({
      ...rest,
      headers: input.headers ? JSON.stringify(input.headers) : undefined,
    })
    .returning()
    .get();

  const data = MonitorSchema.parse(_newMonitor);

  return c.jsonT(data);
});

const deleteRoute = createRoute({
  method: "delete",
  tags: ["monitor"],
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "Deleted",
            }),
          }),
        },
      },
      description: "Delete the monitor",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

monitorApi.openapi(deleteRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const monitorId = Number(id);
  const _monitor = await db
    .select()
    .from(monitor)
    .where(eq(monitor.id, monitorId))
    .get();

  if (!_monitor) return c.jsonT({ code: 404, message: "Not Found" });

  if (workspaceId !== _monitor.workspaceId)
    return c.jsonT({ code: 401, message: "Unauthorized" });

  await db.delete(monitor).where(eq(monitor.id, monitorId)).run();
  return c.jsonT({ message: "Deleted" });
});

export { monitorApi };
