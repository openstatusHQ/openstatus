"use server";

import { auth } from "@/lib/auth";
import { analytics, trackAnalytics } from "@openstatus/analytics";
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

export const RequestAccessToRum = async () => {
  const session = await auth();
  if (!session?.user) return;

  await redis.sadd("rum_access_requested", session.user.email);
  await analytics.identify(session.user.id, { email: session.user.email });
  await trackAnalytics({
    event: "User RUM Beta Requested",
    email: session.user.email || "",
  });
};
