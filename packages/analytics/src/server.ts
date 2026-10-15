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
function createClient(props: IdentifyProps) {
  const client = new OpenPanel({
    clientId: env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
    clientSecret: env.OPENPANEL_CLIENT_SECRET,
  });
  client.setGlobalProperties({
    env: process.env.VERCEL_ENV || env.NODE_ENV || "localhost",
    source: props.source,
    plan: props.plan,
  });
  return client;
}

export type AnalyticsSource =
  | "dashboard"
  | "api"
  | "mcp"
  | "slack"
  | "stripe"
  | "workflows"
  | "web";

export type IdentifyProps = {
  userId?: string;
  fullName?: string | null;
  email?: string;
  workspaceId?: string;
  // Upserts the workspace group; without it events still join the group.
  workspaceName?: string | null;
  plan?: "free" | "starter" | "team" | "scale";
  source?: AnalyticsSource;
  // headers from the request
  location?: string;
  userAgent?: string;
};

// identify, upsertGroup and setGroup are an HTTP round trip each, and
// per-request callers (every API and MCP call) send the same payload over and
// over. Remember which identities this process sent recently and skip them;
// a changed name or plan is a new key, so it still goes out.
const IDENTITY_TTL_MS = 60 * 60 * 1000;
const MAX_IDENTITIES = 10_000;
const sentIdentities = new Map<string, number>();

function identityKey(props: IdentifyProps) {
  return JSON.stringify([
    props.userId,
    props.fullName,
    props.email,
    props.workspaceId,
    props.workspaceName,
    props.plan,
  ]);
}

function wasIdentitySent(key: string) {
  const expiresAt = sentIdentities.get(key);
  if (expiresAt === undefined) return false;
  if (expiresAt > Date.now()) return true;
  sentIdentities.delete(key);
  return false;
}

function markIdentitySent(key: string) {
  // Map iterates in insertion order, so the first key is the oldest.
  if (sentIdentities.size >= MAX_IDENTITIES) {
    const oldest = sentIdentities.keys().next().value;
    if (oldest !== undefined) sentIdentities.delete(oldest);
  }
  sentIdentities.set(key, Date.now() + IDENTITY_TTL_MS);
}

export async function setupAnalytics(props: IdentifyProps) {
  if (env.NODE_ENV !== "production") {
    return noop();
  }

  const op = createClient(props);

  if (props.location) {
    op.api.addHeader("x-client-ip", props.location);
  }

  if (props.userAgent) {
    op.api.addHeader("user-agent", props.userAgent);
  }

  const groupId = props.workspaceId ? `ws_${props.workspaceId}` : undefined;
  // profileId and groups go on each event rather than relying on the client
  // state identify()/setGroup() leave behind, which the cache below skips.
  const track = (opts: EventProps & TrackProperties) => {
    const { name, ...rest } = opts;
    return op.track(name, {
      ...(props.userId ? { profileId: props.userId } : {}),
      ...rest,
      ...(groupId ? { groups: [groupId] } : {}),
    });
  };

  const key = identityKey(props);
  if (wasIdentitySent(key)) return { track };

  if (props.userId) {
    const [firstName, lastName] = props.fullName?.split(" ") || [];
    await op.identify({
      profileId: props.userId,
      email: props.email,
      firstName: firstName,
      lastName: lastName,
    });
  }

  if (groupId && props.workspaceName) {
    await op.upsertGroup({
      id: groupId,
      type: "workspace",
      name: props.workspaceName,
      properties: props.plan ? { plan: props.plan } : undefined,
    });
  }
  // Records membership on the profile; events without a profile only carry `groups`.
  if (groupId && props.userId) {
    await op.setGroup(groupId);
  }
  markIdentitySent(key);

  return { track };
}

export type Analytics = Awaited<ReturnType<typeof setupAnalytics>>;

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
