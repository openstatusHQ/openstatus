import { auth } from "@clerk/nextjs";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

/**
 * Simple Jitsu Event
 */
export async function GET() {
  const { userId } = auth();

  const data = await db
    .select()
    .from(user)
    .where(eq(user.tenantId, String(userId)))
    .get();

  await analytics.identify(data?.id, {
    userId: data?.id,
    email: data?.email,
  });
  await trackAnalytics({
    event: "User Vercel Beta",
  });

  return new Response("OK", { status: 200 });
}
