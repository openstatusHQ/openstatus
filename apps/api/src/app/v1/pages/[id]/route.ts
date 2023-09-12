import { db, eq } from "@openstatus/db";
import { insertPageSchemaWithMonitors, page } from "@openstatus/db/src/schema";

/**
 * @swagger
 * /v1/pages/{id}:
 *   get:
 *     summmary: Returns the status page
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the page to get
 *     tags:
 *        - Status pages
 *     responses:
 *       200:
 *         description: The page
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No page were found
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
    const _page = await db.select().from(page).where(eq(page.id, id)).get();

    if (!_page) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _page.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    return new Response(JSON.stringify(_page), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}

/**
 * @swagger
 * /v1/pages/{id}:
 *   put:
 *     summmary: Returns the status page
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the page to get
 *     tags:
 *        - Status pages
 *     responses:
 *       200:
 *         description: The page
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No page were found
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
    const _page = await db.select().from(page).where(eq(page.id, id)).get();

    if (!_page) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _page.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const json = (await req.json()) as Record<string, unknown>;
    const _valid = insertPageSchemaWithMonitors.safeParse({
      ...json,
      workspaceId,
    });

    if (!_valid.success) {
      return new Response(JSON.stringify(_valid.error), { status: 400 });
    }

    const { data } = _valid;
    const _newPage = await db
      .update(page)
      .set(data)
      .where(eq(page.id, id))
      .returning()
      .get();

    return new Response(JSON.stringify(_newPage), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Internal Error", { status: 500 });
  }
}

/**
 * @swagger
 * /v1/pages/{id}:
 *   delete:
 *     summmary: Returns the status page
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the page to get
 *     tags:
 *        - Status pages
 *     responses:
 *       200:
 *         description: The page
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No page were found
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
    const _page = await db.select().from(page).where(eq(page.id, id)).get();

    if (!_page) {
      return new Response("Not Found", { status: 404 });
    }

    if (workspaceId !== _page.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await db.delete(page).where(eq(page.id, id)).run();

    return new Response("Deleted", { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}
