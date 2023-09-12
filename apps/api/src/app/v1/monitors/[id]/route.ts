import { db, eq, schema } from "@openstatus/db";

const { insertMonitorSchema, monitor } = schema;

/**
 * @swagger
 * /v1/monitors/{id}:
 *   get:
 *     summmary: Returns the monitor
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the monitors to get
 *     tags:
 *        - Monitors
 *     responses:
 *       200:
 *         description: The monitor
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No monitors were found
 *       500:
 *         description: Bad Request
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const workspaceId = Number(req.headers.get("x-workspace-id"));
    const id = Number(params.id);
    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, id))
      .get();

    if (!_monitor) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _monitor.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    return new Response(JSON.stringify(_monitor), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}

/**
 * @swagger
 * /v1/monitors/{id}:
 *   put:
 *     summmary: Update the monitor
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the monitors to get
 *     tags:
 *        - Monitors
 *     responses:
 *       200:
 *         description: The monitor
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No monitors were found
 *       500:
 *         description: Bad Request
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const workspaceId = Number(req.headers.get("x-workspace-id"));
    const id = Number(params.id);
    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, id))
      .get();

    if (!_monitor) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _monitor.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const json = (await req.json()) as Record<string, unknown>;
    const _valid = insertMonitorSchema
      .partial()
      .safeParse({ ...json, workspaceId });

    if (!_valid.success) {
      return new Response(JSON.stringify(_valid.error), { status: 400 });
    }

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

    return new Response(JSON.stringify(_newMonitor), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}

/**
 * @swagger
 * /v1/monitors/{id}:
 *   delete:
 *     summmary: Update the monitor
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the monitors to delete
 *     tags:
 *        - Monitors
 *     responses:
 *       200:
 *         description: The monitor
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No monitors were found
 *       500:
 *         description: Bad Request
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const workspaceId = Number(req.headers.get("x-workspace-id"));
    const id = Number(params.id);
    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, id))
      .get();

    if (!_monitor) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _monitor.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await db.delete(monitor).where(eq(monitor.id, id)).run();

    return new Response("Deleted", { status: 200 });
  } catch (e) {
    console.log(e);

    return new Response("Internal Error", { status: 500 });
  }
}
