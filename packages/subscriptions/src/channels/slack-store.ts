import { Redis } from "@upstash/redis";

export interface SlackThreadAnchor {
  ts: string;
  channelId: string;
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
  isDelivered(
    reportId: number,
    subscriberId: number,
    updateId: number,
  ): Promise<boolean>;
  // Recorded only after a successful post, so a failed delivery can be retried.
  markDelivered(
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
    async isDelivered(reportId, subscriberId, updateId) {
      const res = await getRedis().get<number>(
        deliveredKey(reportId, subscriberId, updateId),
      );
      return res !== null;
    },
    async markDelivered(reportId, subscriberId, updateId) {
      await getRedis().set(deliveredKey(reportId, subscriberId, updateId), 1, {
        ex: TTL_SECONDS,
      });
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
    async isDelivered(reportId, subscriberId, updateId) {
      return delivered.has(deliveredKey(reportId, subscriberId, updateId));
    },
    async markDelivered(reportId, subscriberId, updateId) {
      delivered.add(deliveredKey(reportId, subscriberId, updateId));
    },
  };
}
