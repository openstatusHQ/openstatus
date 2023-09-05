/**
 * REST API SDK
 * Incidents
 */

import { db, eq, schema } from "@openstatus/db";

const { insertIncidentSchema, incident } = schema;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const _incident = await db
      .select()
      .from(incident)
      .where(eq(incident.id, id))
      .get();

    if (!_incident) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(JSON.stringify(_incident), { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const _valid = insertIncidentSchema.safeParse(json);

    if (!_valid.success) {
      return new Response(JSON.stringify(_valid.error), { status: 400 });
    }

    const { data } = _valid;
    const _incident = await db.insert(incident).values(data).returning().get();

    return new Response(JSON.stringify(_incident), { status: 200 });
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
    const _incident = await db
      .select()
      .from(incident)
      .where(eq(incident.id, id))
      .get();

    if (!_incident) {
      return new Response("Not Found", { status: 404 });
    }

    const json = await req.json();
    const _valid = insertIncidentSchema.partial().safeParse(json);

    if (!_valid.success) {
      return new Response(JSON.stringify(_valid.error), { status: 400 });
    }

    const { data } = _valid;
    const _newIncident = await db
      .update(incident)
      .set({
        ..._incident,
        ...data,
      })
      .where(eq(incident.id, id))
      .returning()
      .get();

    return new Response(JSON.stringify(_newIncident), { status: 200 });
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
    const _incident = await db
      .select()
      .from(incident)
      .where(eq(incident.id, id))
      .run();

    if (!_incident) {
      return new Response("Not Found", { status: 404 });
    }

    await db.delete(incident).where(eq(incident.id, id)).run();

    return new Response("Deleted", { status: 200 });
  } catch (e) {
    console.error(e);

    return new Response("Internal Error", { status: 500 });
  }
}
