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
  // Atomically claim the right to post the thread root. Returns a token only
  // for the caller that wins; the winner must `setAnchor` or
  // `releaseAnchorClaim`. `getAnchor` reads a held claim as null.
  claimAnchor(
    event: SlackThreadEvent,
    subscriberId: number,
  ): Promise<string | null>;
  // Drop a claim whose root post failed. No-op unless the key still holds
  // this token, so an expired claimant can't release a newer claim.
  releaseAnchorClaim(
    event: SlackThreadEvent,
    subscriberId: number,
    token: string,
  ): Promise<void>;
  // Atomically claim delivery of (event, subscriber, update). `update` is an
  // update id, or a string key for a delivery that isn't one (root backfill). Returns true only
  // for the caller that wins the claim; concurrent callers get false and must
  // skip. This is the dedupe reservation — a single atomic op, not a
  // read-then-write pair, so two dispatchers can't both post the same message.
  reserveDelivery(
    event: SlackThreadEvent,
    subscriberId: number,
    updateId: number | string,
  ): Promise<boolean>;
  // Release a reservation whose post failed, so the delivery can be retried.
  releaseDelivery(
    event: SlackThreadEvent,
    subscriberId: number,
    updateId: number | string,
  ): Promise<void>;
}

const TTL_SECONDS = 90 * 24 * 60 * 60;
// Short so a winner that dies mid-post doesn't block the thread for long;
// `setAnchor` replaces the claim with the full TTL. A root post retried by the
// Slack client past this can open a second root — preferred over losers
// dropping their updates for the length of the client's retry window.
const CLAIM_TTL_SECONDS = 60;

interface SlackAnchorClaim {
  pending: string;
}

// Delete only while the key still holds this claim, never a real anchor or a
// newer claim. Upstash JSON-serializes values, so ARGV[1] is the stringified
// claim.
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
  updateId: number | string,
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
      const claim: SlackAnchorClaim = { pending: crypto.randomUUID() };
      const res = await getRedis().set(anchorKey(event, subscriberId), claim, {
        ex: CLAIM_TTL_SECONDS,
        nx: true,
      });
      return res === "OK" ? claim.pending : null;
    },
    async releaseAnchorClaim(event, subscriberId, token) {
      const claim: SlackAnchorClaim = { pending: token };
      await getRedis().eval(
        RELEASE_CLAIM,
        [anchorKey(event, subscriberId)],
        [JSON.stringify(claim)],
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
  const claims = new Map<string, string>();
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
      if (anchors.has(key) || claims.has(key)) return null;
      const token = crypto.randomUUID();
      claims.set(key, token);
      return token;
    },
    async releaseAnchorClaim(event, subscriberId, token) {
      const key = anchorKey(event, subscriberId);
      if (claims.get(key) === token) claims.delete(key);
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
