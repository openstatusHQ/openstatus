import { db } from "@openstatus/db";
import { insertPageSchemaWithMonitors, page } from "@openstatus/db/src/schema";

/**
 * @swagger
 * /v1/status-pages:
 *   post:
 *     summmary: Create a new status page
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the monitors to get
 *     tags:
 *        - Status pages
 *     security:
 *      - ApiKeyAuth: []
 *     requestBody:
 *       description: Create a new booking related to one of your event-types
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *              name:
 *               type: string
 *               example: "My Status Page"
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
    const json = await req.json();
    const _valid = insertPageSchemaWithMonitors.safeParse(json);

    if (!_valid.success) {
      return new Response(JSON.stringify(_valid.error), { status: 400 });
    }

    const { data } = _valid;
    const _page = await db.insert(page).values(data).returning().get();

    return new Response(JSON.stringify(_page), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}
