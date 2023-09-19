import { auth } from "@clerk/nextjs";

import { analytics, trackAnalytics } from "@openstatus/analytics";

/**
 * Simple Jitsu Event
 */
export async function GET() {
  const { userId } = auth();

  await analytics.identify(userId, {
    userId: userId,
  });
  await trackAnalytics({
    event: "User Vercel Beta",
  });

  return new Response("OK", { status: 200 });
}
