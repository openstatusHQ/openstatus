import type { Context, Env } from "hono";

import { db, eq, schema } from "@openstatus/db";

const { insertMonitorSchema, monitor } = schema;

export async function POST(c: Context<Env, "/", {}>) {
  try {
    const workspaceId = Number(c.req.header("x-workspace-id"));
    const json = await c.req.json();
    const _valid = insertMonitorSchema.safeParse({ ...json, workspaceId });

    if (!_valid.success) return c.json(_valid.error, 400);

    const { data } = _valid;
    const _monitor = await db
      .insert(monitor)
      .values({
        ...data,
        regions: data.regions?.join(","), // mapping array to string
        headers: data.headers ? JSON.parse(String(data.headers)) : undefined, // mapping JSON to string
      })
      .returning()
      .get();

    return c.json(_monitor, 200);
  } catch (e) {
    console.error(e);

    return c.text("Internal Error", 500);
  }
}

export async function GET(c: Context<Env, "/:id", {}>) {
  try {
    const workspaceId = Number(c.req.header("x-workspace-id"));
    const id = Number(c.req.param("id"));

    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, id))
      .get();

    if (!_monitor) return c.text("Not Found", 404);

    if (workspaceId !== _monitor.workspaceId)
      return c.text("Unauthorized", 401);

    return c.json(_monitor, 200);
  } catch (e) {
    console.error(e);

    return c.text("Internal Error", 500);
  }
}

export async function PUT(c: Context<Env, "/:id", {}>) {
  try {
    const workspaceId = Number(c.req.header("x-workspace-id"));
    const id = Number(c.req.param("id"));

    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, id))
      .get();

    if (!_monitor) return c.text("Not Found", 404);

    if (workspaceId !== _monitor.workspaceId)
      return c.text("Unauthorized", 401);

    const json = await c.req.json();
    const _valid = insertMonitorSchema
      .partial()
      .safeParse({ ...json, workspaceId });

    if (!_valid.success) return c.json(_valid.error, 400);

    const { data } = _valid;
    const _newMonitor = await db
      .update(monitor)
      .set({
        ..._monitor,
        ...data,
        regions: (data || _monitor).regions?.join(","), // mapping array to string
        headers:
          data.headers || _monitor.headers
            ? JSON.parse(String((data || _monitor).headers))
            : undefined, // mapping JSON to string
      })
      .where(eq(monitor.id, id))
      .returning()
      .get();

    return c.json(_newMonitor, 200);
  } catch (e) {
    console.error(e);

    return c.text("Internal Error", 500);
  }
}

export async function DELETE(c: Context<Env, "/:id", {}>) {
  try {
    const workspaceId = Number(c.req.header("x-workspace-id"));
    const id = Number(c.req.param("id"));

    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, id))
      .get();

    if (!_monitor) return c.text("Not Found", 404);

    if (workspaceId !== _monitor.workspaceId)
      return c.text("Unauthorized", 401);

    await db.delete(monitor).where(eq(monitor.id, id)).run();

    return c.text("Deleted", 200);
  } catch (e) {
    console.log(e);

    return c.text("Internal Error", 500);
  }
}
