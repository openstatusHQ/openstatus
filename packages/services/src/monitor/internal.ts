import {
  type Assertion,
  DnsRecordAssertion,
  HeaderAssertion,
  JsonBodyAssertion,
  StatusAssertion,
  TextBodyAssertion,
  serialize,
} from "@openstatus/assertions";
import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  monitorTag,
  notification,
  privateLocation,
} from "@openstatus/db/src/schema";
import {
  freeFlyRegions,
  monitorRegions,
} from "@openstatus/db/src/schema/constants";
import { regionDict } from "@openstatus/regions";

import type { DB } from "../context";
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { toBase64Url } from "../oauth/crypto";
import type { Workspace } from "../types";

/** Load a monitor by id, scoped to the workspace and excluding soft-deleted. */
export async function getMonitorInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(monitor)
    .where(
      and(
        eq(monitor.id, id),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("monitor", id);
  return row;
}

/** Validate that tag ids exist and belong to the workspace. */
export async function validateTagIds(args: {
  tx: DB;
  workspaceId: number;
  tagIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const { tx, workspaceId, tagIds } = args;
  if (tagIds.length === 0) return [];
  const ids = Array.from(new Set(tagIds));
  const rows = await tx
    .select({ id: monitorTag.id })
    .from(monitorTag)
    .where(
      and(inArray(monitorTag.id, ids), eq(monitorTag.workspaceId, workspaceId)),
    )
    .all();
  const valid = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!valid.has(id))
      throw new ForbiddenError(`Tag ${id} is not accessible.`);
  }
  return ids;
}

/** Validate that notification ids exist and belong to the workspace. */
export async function validateNotificationIds(args: {
  tx: DB;
  workspaceId: number;
  notificationIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const { tx, workspaceId, notificationIds } = args;
  if (notificationIds.length === 0) return [];
  const ids = Array.from(new Set(notificationIds));
  const rows = await tx
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        inArray(notification.id, ids),
        eq(notification.workspaceId, workspaceId),
      ),
    )
    .all();
  const valid = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!valid.has(id)) {
      throw new ForbiddenError(`Notification ${id} is not accessible.`);
    }
  }
  return ids;
}

/** Validate that private location ids exist and belong to the workspace. */
export async function validatePrivateLocationIds(args: {
  tx: DB;
  workspaceId: number;
  privateLocationIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const { tx, workspaceId, privateLocationIds } = args;
  if (privateLocationIds.length === 0) return [];
  const ids = Array.from(new Set(privateLocationIds));
  const rows = await tx
    .select({ id: privateLocation.id })
    .from(privateLocation)
    .where(
      and(
        inArray(privateLocation.id, ids),
        eq(privateLocation.workspaceId, workspaceId),
      ),
    )
    .all();
  const valid = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!valid.has(id)) {
      throw new ForbiddenError(`Private location ${id} is not accessible.`);
    }
  }
  return ids;
}

/** Translate UI `{key,value}[]` headers into the stored JSON string, or `null`. */
export function headersToDbJson(
  headers: ReadonlyArray<{ key: string; value: string }> | undefined,
): string | undefined {
  if (headers === undefined) return undefined;
  return JSON.stringify(headers);
}

/**
 * Build an `Assertion[]` from a UI discriminated-union list and serialise to
 * the stored JSON string. `null` means "no assertions configured".
 */
export function serialiseAssertions(
  list: ReadonlyArray<{ type: string } & Record<string, unknown>> | undefined,
): string {
  const assertions: Assertion[] = [];
  for (const a of list ?? []) {
    if (a.type === "status") assertions.push(new StatusAssertion(a as never));
    else if (a.type === "header")
      assertions.push(new HeaderAssertion(a as never));
    else if (a.type === "textBody")
      assertions.push(new TextBodyAssertion(a as never));
    else if (a.type === "jsonBody")
      assertions.push(new JsonBodyAssertion(a as never));
    else if (a.type === "dnsRecord")
      assertions.push(new DnsRecordAssertion(a as never));
  }
  return serialize(assertions);
}

/**
 * Pick the default regions for a new monitor based on the workspace's plan.
 * Matches the old tRPC "randomly choose 4 free regions / 6 paid regions,
 * excluding deprecated" logic.
 */
export function pickDefaultRegions(workspace: Workspace): {
  regions: string[];
  periodicity: "30m" | "1m";
} {
  const selectable =
    workspace.plan === "free" ? freeFlyRegions : monitorRegions;
  const count = workspace.plan === "free" ? 4 : 6;
  const regions = [...selectable]
    .filter((r) => {
      const deprecated = regionDict[r].deprecated;
      return !deprecated;
    })
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
  return {
    regions,
    periodicity: workspace.plan === "free" ? "30m" : "1m",
  };
}

/**
 * Enforce the plan's periodicity, region-count and region-access limits on
 * a monitor's scheduling. Shared by every path that writes them so a clone
 * (or a source that predates a downgrade) can't carry out-of-plan values.
 * A field left `undefined` isn't being written and isn't checked, so a
 * partial update of a monitor that predates a downgrade still goes through.
 */
export function assertSchedulingWithinPlan(
  limits: Workspace["limits"],
  scheduling: { periodicity?: string; regions?: ReadonlyArray<string> },
): void {
  const { periodicity, regions } = scheduling;
  if (
    periodicity !== undefined &&
    !limits.periodicity.includes(
      periodicity as (typeof limits)["periodicity"][number],
    )
  ) {
    throw new LimitExceededError("periodicity", limits.periodicity.length);
  }
  if (regions === undefined) return;
  if (limits["max-regions"] < regions.length) {
    throw new LimitExceededError("max-regions", limits["max-regions"]);
  }
  if (
    regions.length > 0 &&
    !regions.every((r) =>
      limits.regions.includes(r as (typeof limits)["regions"][number]),
    )
  ) {
    throw new LimitExceededError("regions", limits.regions.length);
  }
}

// The token authenticates pings; keep a fingerprint so a rotation still diffs
// without storing any of it. Web Crypto keeps this module Edge-safe.
export async function monitorAuditSnapshot<
  T extends { heartbeatToken: string | null },
>(row: T): Promise<T> {
  if (!row.heartbeatToken) return row;
  const data = new TextEncoder().encode(row.heartbeatToken);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const fingerprint = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return { ...row, heartbeatToken: `sha256:${fingerprint}` };
}

// Ping details are private and a heartbeat has no latency to chart, so the
// public monitor pages never show one.
export function assertHeartbeatNotPublic(
  row: { jobType: string },
  isPublic: boolean | undefined,
) {
  if (row.jobType === "heartbeat" && isPublic) {
    throw new ValidationError("Heartbeat monitors cannot be public");
  }
}

export function generateHeartbeatToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}
