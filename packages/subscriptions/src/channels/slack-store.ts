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

export interface SlackAnchorStore {
  getAnchor(
    reportId: number,
    subscriberId: number,
  ): Promise<SlackThreadAnchor | null>;
  setAnchor(
    reportId: number,
    subscriberId: number,
    anchor: SlackThreadAnchor,
  ): Promise<void>;
  clearAnchor(reportId: number, subscriberId: number): Promise<void>;
  // Atomically claim delivery of (report, subscriber, update). Returns true only
  // for the caller that wins the claim; concurrent callers get false and must
  // skip. This is the dedupe reservation — a single atomic op, not a
  // read-then-write pair, so two dispatchers can't both post the same message.
  reserveDelivery(
    reportId: number,
    subscriberId: number,
    updateId: number,
  ): Promise<boolean>;
  // Release a reservation whose post failed, so the delivery can be retried.
  releaseDelivery(
    reportId: number,
    subscriberId: number,
    updateId: number,
  ): Promise<void>;
}

const TTL_SECONDS = 90 * 24 * 60 * 60;

function anchorKey(reportId: number, subscriberId: number): string {
  return `slack:report:${reportId}:sub:${subscriberId}`;
}

function deliveredKey(
  reportId: number,
  subscriberId: number,
  updateId: number,
): string {
  return `${anchorKey(reportId, subscriberId)}:update:${updateId}`;
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
    async getAnchor(reportId, subscriberId) {
      const raw = await getRedis().get<SlackThreadAnchor>(
        anchorKey(reportId, subscriberId),
      );
      return raw ?? null;
    },
    async setAnchor(reportId, subscriberId, anchor) {
      await getRedis().set(anchorKey(reportId, subscriberId), anchor, {
        ex: TTL_SECONDS,
      });
    },
    async clearAnchor(reportId, subscriberId) {
      await getRedis().del(anchorKey(reportId, subscriberId));
    },
    async reserveDelivery(reportId, subscriberId, updateId) {
      const res = await getRedis().set(
        deliveredKey(reportId, subscriberId, updateId),
        1,
        { ex: TTL_SECONDS, nx: true },
      );
      return res === "OK";
    },
    async releaseDelivery(reportId, subscriberId, updateId) {
      await getRedis().del(deliveredKey(reportId, subscriberId, updateId));
    },
  };
}

export function createMemoryAnchorStore(): SlackAnchorStore {
  const anchors = new Map<string, SlackThreadAnchor>();
  const delivered = new Set<string>();
  return {
    async getAnchor(reportId, subscriberId) {
      return anchors.get(anchorKey(reportId, subscriberId)) ?? null;
    },
    async setAnchor(reportId, subscriberId, anchor) {
      anchors.set(anchorKey(reportId, subscriberId), anchor);
    },
    async clearAnchor(reportId, subscriberId) {
      anchors.delete(anchorKey(reportId, subscriberId));
    },
    async reserveDelivery(reportId, subscriberId, updateId) {
      const key = deliveredKey(reportId, subscriberId, updateId);
      if (delivered.has(key)) return false;
      delivered.add(key);
      return true;
    },
    async releaseDelivery(reportId, subscriberId, updateId) {
      delivered.delete(deliveredKey(reportId, subscriberId, updateId));
    },
  };
}
