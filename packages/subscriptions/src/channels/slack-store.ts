import { Redis } from "@upstash/redis";

import type { SlackReplyMessage } from "./slack-blocks";

export interface SlackThreadAnchor {
  ts: string;
  channelId: string;
  // The first update lives only in the root message until a second update
  // arrives and re-renders the root. We stash its reply payload here so the
  // next update can backfill it into the thread before it's overwritten.
  pendingRootReply?: SlackReplyMessage;
}

// The entity a thread belongs to. Report and maintenance ids come from
// different tables, so the kind keeps their anchors apart.
export interface SlackThreadEvent {
  kind: "report" | "maintenance";
  id: number;
}

export interface SlackAnchorStore {
  getAnchor(
    event: SlackThreadEvent,
    subscriberId: number,
  ): Promise<SlackThreadAnchor | null>;
  setAnchor(
    event: SlackThreadEvent,
    subscriberId: number,
    anchor: SlackThreadAnchor,
  ): Promise<void>;
  clearAnchor(event: SlackThreadEvent, subscriberId: number): Promise<void>;
  // Atomically claim the right to post the thread root. Returns true only for
  // the caller that wins; the winner must `setAnchor` or `releaseAnchorClaim`.
  // `getAnchor` reads a held claim as null.
  claimAnchor(event: SlackThreadEvent, subscriberId: number): Promise<boolean>;
  // Drop a claim whose root post failed. No-op once a real anchor is set.
  releaseAnchorClaim(
    event: SlackThreadEvent,
    subscriberId: number,
  ): Promise<void>;
  // Atomically claim delivery of (event, subscriber, update). Returns true only
  // for the caller that wins the claim; concurrent callers get false and must
  // skip. This is the dedupe reservation — a single atomic op, not a
  // read-then-write pair, so two dispatchers can't both post the same message.
  reserveDelivery(
    event: SlackThreadEvent,
    subscriberId: number,
    updateId: number,
  ): Promise<boolean>;
  // Release a reservation whose post failed, so the delivery can be retried.
  releaseDelivery(
    event: SlackThreadEvent,
    subscriberId: number,
    updateId: number,
  ): Promise<void>;
}

const TTL_SECONDS = 90 * 24 * 60 * 60;
// Short so a winner that crashes mid-post doesn't block the thread for long;
// `setAnchor` replaces the claim with the full TTL.
const CLAIM_TTL_SECONDS = 60;

const ANCHOR_CLAIM = { pending: true } as const;
type SlackAnchorClaim = typeof ANCHOR_CLAIM;

// Delete only while the key still holds the claim, never a real anchor.
// Upstash JSON-serializes values, so ARGV[1] is the stringified claim.
const RELEASE_CLAIM = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

function anchorKey(event: SlackThreadEvent, subscriberId: number): string {
  return `slack:${event.kind}:${event.id}:sub:${subscriberId}`;
}

function deliveredKey(
  event: SlackThreadEvent,
  subscriberId: number,
  updateId: number,
): string {
  return `${anchorKey(event, subscriberId)}:update:${updateId}`;
}

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

export function createRedisAnchorStore(): SlackAnchorStore {
  return {
    async getAnchor(event, subscriberId) {
      const raw = await getRedis().get<SlackThreadAnchor | SlackAnchorClaim>(
        anchorKey(event, subscriberId),
      );
      if (!raw || "pending" in raw) return null;
      return raw;
    },
    async setAnchor(event, subscriberId, anchor) {
      await getRedis().set(anchorKey(event, subscriberId), anchor, {
        ex: TTL_SECONDS,
      });
    },
    async clearAnchor(event, subscriberId) {
      await getRedis().del(anchorKey(event, subscriberId));
    },
    async claimAnchor(event, subscriberId) {
      const res = await getRedis().set(
        anchorKey(event, subscriberId),
        ANCHOR_CLAIM,
        { ex: CLAIM_TTL_SECONDS, nx: true },
      );
      return res === "OK";
    },
    async releaseAnchorClaim(event, subscriberId) {
      await getRedis().eval(
        RELEASE_CLAIM,
        [anchorKey(event, subscriberId)],
        [JSON.stringify(ANCHOR_CLAIM)],
      );
    },
    async reserveDelivery(event, subscriberId, updateId) {
      const res = await getRedis().set(
        deliveredKey(event, subscriberId, updateId),
        1,
        { ex: TTL_SECONDS, nx: true },
      );
      return res === "OK";
    },
    async releaseDelivery(event, subscriberId, updateId) {
      await getRedis().del(deliveredKey(event, subscriberId, updateId));
    },
  };
}

export function createMemoryAnchorStore(): SlackAnchorStore {
  const anchors = new Map<string, SlackThreadAnchor>();
  const claims = new Set<string>();
  const delivered = new Set<string>();
  return {
    async getAnchor(event, subscriberId) {
      return anchors.get(anchorKey(event, subscriberId)) ?? null;
    },
    async setAnchor(event, subscriberId, anchor) {
      const key = anchorKey(event, subscriberId);
      claims.delete(key);
      anchors.set(key, anchor);
    },
    async clearAnchor(event, subscriberId) {
      const key = anchorKey(event, subscriberId);
      claims.delete(key);
      anchors.delete(key);
    },
    async claimAnchor(event, subscriberId) {
      const key = anchorKey(event, subscriberId);
      if (anchors.has(key) || claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    async releaseAnchorClaim(event, subscriberId) {
      claims.delete(anchorKey(event, subscriberId));
    },
    async reserveDelivery(event, subscriberId, updateId) {
      const key = deliveredKey(event, subscriberId, updateId);
      if (delivered.has(key)) return false;
      delivered.add(key);
      return true;
    },
    async releaseDelivery(event, subscriberId, updateId) {
      delivered.delete(deliveredKey(event, subscriberId, updateId));
    },
  };
}
