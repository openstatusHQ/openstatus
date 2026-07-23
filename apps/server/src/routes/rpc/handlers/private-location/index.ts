import type { ServiceImpl } from "@connectrpc/connect";
import type { PrivateLocationService } from "@openstatus/proto/private_location/v1";
import { NotFoundError } from "@openstatus/services";
import {
  createPrivateLocation,
  deletePrivateLocation,
  getPrivateLocation,
  listPrivateLocations,
  updatePrivateLocation,
} from "@openstatus/services/private-location";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  dbPrivateLocationToProto,
  dbPrivateLocationToProtoSummary,
} from "./converters";
import {
  invalidMonitorIdError,
  privateLocationIdRequiredError,
  privateLocationNotFoundError,
} from "./errors";
import { checkPrivateLocationsEnabled } from "./limits";

// Map the service's generic NotFoundError to a ConnectError carrying the
// documented error-reason header for this entity, then defer everything else
// to the shared mapper.
function toPrivateLocationConnectError(err: unknown, id: string): never {
  if (err instanceof NotFoundError && err.entity === "private_location") {
    throw privateLocationNotFoundError(id);
  }
  toConnectError(err);
}

// `Number.parseInt` rather than `Number` — `Number("")` is 0 (finite!), which
// would silently target row 0 instead of failing.
function parseId(id: string): number {
  const n = Number.parseInt(id, 10);
  if (!Number.isFinite(n)) throw privateLocationIdRequiredError();
  return n;
}

function parseMonitorIds(ids: ReadonlyArray<string>): number[] {
  return ids.map((id) => {
    const n = Number.parseInt(id, 10);
    if (!Number.isFinite(n)) throw invalidMonitorIdError(id);
    return n;
  });
}

function requireId(id: string): number {
  if (!id || id.trim() === "") throw privateLocationIdRequiredError();
  return parseId(id);
}

export const privateLocationServiceImpl: ServiceImpl<
  typeof PrivateLocationService
> = {
  async createPrivateLocation(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      checkPrivateLocationsEnabled(rpcCtx.workspace.limits);
      const sCtx = toServiceCtx(rpcCtx);

      const created = await createPrivateLocation({
        ctx: sCtx,
        input: {
          name: req.name,
          monitors: parseMonitorIds(req.monitorIds),
          metadata: req.metadata,
        },
      });

      // Re-fetch so the response reflects stored ids (deduped), not the request.
      const full = await getPrivateLocation({
        ctx: sCtx,
        input: { id: created.id },
      });

      return {
        privateLocation: dbPrivateLocationToProto(
          full,
          full.monitors.map((m) => String(m.id)),
        ),
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getPrivateLocation(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const full = await getPrivateLocation({
        ctx: toServiceCtx(rpcCtx),
        input: { id: requireId(req.id) },
      });

      return {
        privateLocation: dbPrivateLocationToProto(
          full,
          full.monitors.map((m) => String(m.id)),
        ),
      };
    } catch (err) {
      toPrivateLocationConnectError(err, req.id);
    }
  },

  async listPrivateLocations(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);

      const { items, totalSize } = await listPrivateLocations({
        ctx: toServiceCtx(rpcCtx),
        input: {
          limit: Math.min(Math.max(req.limit ?? 50, 1), 100),
          offset: req.offset ?? 0,
        },
      });

      return {
        privateLocations: items.map((item) =>
          dbPrivateLocationToProtoSummary(item, item.monitors.length),
        ),
        totalSize,
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updatePrivateLocation(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      checkPrivateLocationsEnabled(rpcCtx.workspace.limits);
      const sCtx = toServiceCtx(rpcCtx);
      const id = requireId(req.id);

      await updatePrivateLocation({
        ctx: sCtx,
        input: {
          id,
          name:
            req.name !== undefined && req.name !== "" ? req.name : undefined,
          monitors: req.updateMonitorIds
            ? parseMonitorIds(req.monitorIds)
            : undefined,
          metadata: req.updateMetadata ? req.metadata : undefined,
        },
      });

      const full = await getPrivateLocation({ ctx: sCtx, input: { id } });

      return {
        privateLocation: dbPrivateLocationToProto(
          full,
          full.monitors.map((m) => String(m.id)),
        ),
      };
    } catch (err) {
      toPrivateLocationConnectError(err, req.id);
    }
  },

  async deletePrivateLocation(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      await deletePrivateLocation({
        ctx: toServiceCtx(rpcCtx),
        input: { id: requireId(req.id) },
      });
      return { success: true };
    } catch (err) {
      toConnectError(err);
    }
  },
};
