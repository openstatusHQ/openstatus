"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { User } from "@clerk/nextjs/dist/types/server";
import type { CaptureOptions, Properties } from "posthog-js";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

import { env } from "@/env";

if (typeof window !== "undefined") {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false, // Disable automatic pageview capture, as we capture manually
    disable_session_recording: false, // Enable automatic session recording
  });
}

export function PostHogPageview(): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return <></>;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
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
  // REMINDER: similar to how we retrieve the email address on first login (take the first one)
  posthog.identify(user.id, { email: user.emailAddresses?.[0].emailAddress });
}
