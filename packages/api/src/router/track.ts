import { Events } from "@openstatus/analytics";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

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
});
