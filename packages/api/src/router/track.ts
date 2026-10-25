import { Events, setupAnalytics } from "@openstatus/analytics";
import { incrWithTtl, redis } from "@openstatus/upstash";
import { TRPCError } from "@trpc/server";
import { after } from "next/server.js";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const stepStatus = z.enum(["completed", "skipped", "none"]);

// Tracking-only procedures for UI moments with no mutation of their own.
// Server-side so the events carry user, workspace and plan like every other.
export const trackRouter = createTRPCRouter({
  onboardingSkip: protectedProcedure
    .meta({ track: Events.SkipOnboarding, trackProps: ["step"] })
    .input(z.object({ step: z.enum(["monitor", "page"]) }))
    .mutation(() => ({ ok: true })),

  onboardingComplete: protectedProcedure
    .meta({
      track: Events.CompleteOnboarding,
      trackProps: ["monitor", "page"],
    })
    .input(z.object({ monitor: stepStatus, page: stepStatus }))
    .mutation(() => ({ ok: true })),

  // Anonymous marketing-site event; `.meta({ track })` only runs on
  // protectedProcedure, so this tracks by hand like the play/* routes.
  contentCopied: publicProcedure
    .input(
      z.object({
        kind: z.enum(["link", "markdown"]),
        path: z.string().max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Unauthenticated, so the IP is the only handle on a flood of events.
      const ip =
        ctx.req?.headers.get("x-real-ip") ??
        ctx.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      if (ip) {
        // Best-effort tracking: a Redis outage drops the limiter, not the event.
        let count = 0;
        try {
          [count] = await incrWithTtl(
            redis,
            [`ratelimit:track:content-copied:${ip}`],
            60,
          );
        } catch (error) {
          console.error("contentCopied rate limit unavailable", error);
        }
        if (count > 20) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      }
      after(async () => {
        const analytics = await setupAnalytics({ source: "web" });
        await analytics.track({ ...Events.ContentCopied, ...input });
      });
      return { ok: true };
    }),
});
