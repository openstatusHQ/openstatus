import { OpenPanel, type PostEventPayload } from "@openpanel/sdk";
import { env } from "../env";
import type { EventProps } from "./events";

const op = new OpenPanel({
  clientId: env.OPENPANEL_CLIENT_ID,
  clientSecret: env.OPENPANEL_CLIENT_SECRET,
});

op.setGlobalProperties({
  env: process.env.VERCEL_ENV || process.env.NODE_ENV || "localhost",
  // app_version
});

export type IdentifyProps = {
  userId?: string;
  fullName?: string | null;
  email?: string;
  workspaceId?: string;
  plan?: string;
  // headers from the request
  location?: string;
  userAgent?: string;
};

export async function setupAnalytics(props: IdentifyProps) {
  if (process.env.NODE_ENV !== "production") {
    return noop();
  }

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
    track: (opts: EventProps & PostEventPayload["properties"]) => {
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
    track: (
      opts: EventProps & PostEventPayload["properties"],
    ): Promise<unknown> => {
      return new Promise((resolve) => {
        console.log(`>>> Track Noop Event: ${opts.name}`);
        resolve(null);
      });
    },
  };
}
