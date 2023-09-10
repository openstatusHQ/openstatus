import { db, eq } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";

/**
 * @swagger
 * /v1/incidents/{id}:
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
    const _incident = await db
      .select()
      .from(incident)
      .where(eq(incident.id, id))
      .get();

    if (!_incident) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _incident.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    return new Response(JSON.stringify(_incident), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}
