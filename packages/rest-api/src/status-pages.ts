/**
 * REST API SDK
 * Status Pages
 */

import { db, eq, schema } from "@openstatus/db";

const { page, insertPageSchemaWithMonitors } = schema;

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
