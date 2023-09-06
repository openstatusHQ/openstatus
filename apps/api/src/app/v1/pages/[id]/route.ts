import { db, eq } from "@openstatus/db";
import { insertPageSchemaWithMonitors, page } from "@openstatus/db/src/schema";

/**
 * @swagger
 * /v1/status-pages/{id}:
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
 *       404:
 *         description: No page were found
 *       500:
 *         description: Bad Request
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const _page = await db.select().from(page).where(eq(page.id, id)).get();

    if (!_page) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(JSON.stringify(_page), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}

/**
 * @swagger
 * /v1/status-pages/{id}:
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
    const id = Number(params.id);
    const _page = await db.select().from(page).where(eq(page.id, id)).get();

    if (!_page) {
      return new Response("Not Found", { status: 404 });
    }

    const json = await req.json();
    const _valid = insertPageSchemaWithMonitors.safeParse(json);

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
 * /v1/status-pages/{id}:
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
 *       404:
 *         description: No page were found
 *       500:
 *         description: Bad Request
 */
export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    const _page = await db.select().from(page).where(eq(page.id, id)).get();
    if (!_page) {
      return new Response("Not Found", { status: 404 });
    }

    await db.delete(page).where(eq(page.id, id)).run();

    return new Response("Deleted", { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}
