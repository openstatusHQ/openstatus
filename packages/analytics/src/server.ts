import { OpenPanel, type TrackProperties } from "@openpanel/sdk";

import { env } from "../env";
import type { EventProps } from "./events";

// Instantiated per call rather than shared: the OpenPanel client carries
// per-request mutable state (the `x-client-ip`/`user-agent` headers set below
// and the `profileId` that `identify()` stores and `track()` reads back), so a
// module-level singleton lets concurrent requests overwrite each other and
// attribute events to the wrong IP, user agent or profile.
// Constructing it here also keeps importing this module side-effect free — a
// top-level `new OpenPanel()` runs the node SDK at import time, which breaks
// bundling the tRPC context into the Edge runtime.
function createClient() {
  const client = new OpenPanel({
    clientId: env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
    clientSecret: env.OPENPANEL_CLIENT_SECRET,
  });
  client.setGlobalProperties({
    env: process.env.VERCEL_ENV || env.NODE_ENV || "localhost",
    // app_version
  });
  return client;
}

export type IdentifyProps = {
  userId?: string;
  fullName?: string | null;
  email?: string;
  workspaceId?: string;
  plan?: "free" | "starter" | "team" | "scale";
  // headers from the request
  location?: string;
  userAgent?: string;
};

export async function setupAnalytics(props: IdentifyProps) {
  if (env.NODE_ENV !== "production") {
    return noop();
  }

  const op = createClient();

  if (props.location) {
    op.api.addHeader("x-client-ip", props.location);
  }

  if (props.userAgent) {
    op.api.addHeader("user-agent", props.userAgent);
  }

  if (props.userId) {
    const [firstName, lastName] = props.fullName?.split(" ") || [];
    await op.identify({
      profileId: props.userId,
      email: props.email,
      firstName: firstName,
      lastName: lastName,
      properties: {
        workspaceId: props.workspaceId,
        plan: props.plan,
      },
    });
  }

  return {
    track: (opts: EventProps & TrackProperties) => {
      const { name, ...rest } = opts;
      return op.track(name, rest);
    },
  };
}

/**
 * Noop analytics for development environment
 */
async function noop() {
  return {
    track: (opts: EventProps & TrackProperties): Promise<unknown> => {
      return new Promise((resolve) => {
        console.log(`>>> Track Noop Event: ${opts.name}`);
        resolve(null);
      });
    },
  };
}
