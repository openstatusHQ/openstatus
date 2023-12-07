import { and, db, eq } from "@openstatus/db";
import { page, statusReportSubscriber } from "@openstatus/db/src/schema";

export async function GET(
  request: Request,
  { params }: { params: { domain: string; token: string } },
) {
  const statusReportId = await db
    .select()
    .from(page)
    .where(eq(page.slug, params.domain))
    .get();
  if (!statusReportId) {
    return new Response("Not found", { status: 401 });
  }

  const subscriber = await db
    .select()
    .from(statusReportSubscriber)
    .where(
      and(
        eq(statusReportSubscriber.verificationToken, params.token),
        eq(statusReportSubscriber.statusReportId, statusReportId?.id),
      ),
    )
    .get();

  if (!subscriber) {
    return new Response("Not found", { status: 401 });
  }

  await db
    .update(statusReportSubscriber)
    .set({ validatedAt: new Date() })
    .where(eq(statusReportSubscriber.id, subscriber.id))
    .execute();

  return Response.redirect(`https://${params.domain}.openstatus.dev`);
}
