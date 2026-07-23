import { OpenPanel, type TrackProperties } from "@openpanel/sdk";

import { env } from "../env";
import type { EventProps } from "./events";

// Lazily instantiate so importing this module has no side effects — a top-level
// `new OpenPanel()` runs the node SDK at import time, which breaks bundling the
// tRPC context into the Edge runtime.
let client: OpenPanel | undefined;

function getClient() {
  if (!client) {
    client = new OpenPanel({
      clientId: env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
      clientSecret: env.OPENPANEL_CLIENT_SECRET,
    });
    client.setGlobalProperties({
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "localhost",
      // app_version
    });
  }
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
  if (process.env.NODE_ENV !== "production") {
    return noop();
  }

  const op = getClient();

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
