import { and, db, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";

export async function GET(
  _request: Request,
  props: { params: Promise<{ domain: string; token: string }> },
) {
  const params = await props.params;
  const pageId = await db
    .select()
    .from(page)
    .where(eq(page.slug, params.domain))
    .get();
  if (!pageId) {
    return new Response("Not found", { status: 401 });
  }

  const subscriber = await db
    .select()
    .from(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.token, params.token),
        eq(pageSubscriber.pageId, pageId?.id),
      ),
    )
    .get();

  if (!subscriber) {
    return new Response("Not found", { status: 401 });
  }

  await db
    .update(pageSubscriber)
    .set({ acceptedAt: new Date() })
    .where(eq(pageSubscriber.id, subscriber.id))
    .execute();

  return Response.redirect(`https://${params.domain}.openstatus.dev`);
}
