import { db } from "@openstatus/db";
import { insertMonitorSchema, monitor } from "@openstatus/db/src/schema";

// TODO: make sure that only valid frequency values (based on plan) are allowed

/**
 * @swagger
 * /v1/monitors:
 *   post:
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
 *       404:
 *         description: No monitors were found
 *       500:
 *         description: Bad Request
 */
export async function POST(req: Request) {
  try {
    const workspaceId = Number(req.headers.get("x-workspace-id"));
    const json = (await req.json()) as Record<string, unknown>;
    const _valid = insertMonitorSchema.safeParse({ ...json, workspaceId });

    if (!_valid.success) {
      return new Response(JSON.stringify(_valid.error), { status: 400 });
    }

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

    return new Response(JSON.stringify(_monitor), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}
