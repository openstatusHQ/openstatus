"use client";

import type { User } from "next-auth";
import type { CaptureOptions, Properties } from "posthog-js";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { SuspendedPostHogPageView } from "./pageview";

import { env } from "@/env";
import { useEffect } from "react";

export function PHProvider({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "production") return children;

  useEffect(() => {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false, // Disable automatic pageview capture, as we capture manually
      capture_pageleave: true, // Enable automatic pageleave capture
      disable_session_recording: false, // Enable automatic session recording
    });
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PostHogProvider>
  );
}

export function trackEvent({
  name,
  props,
  opts,
}: {
  name: string;
  props: Properties;
  opts: CaptureOptions;
}) {
  posthog.capture(name, props, opts);
}

export function identifyUser({ user }: { user: User }) {
  posthog.identify(user.id, { email: user.email });
}
