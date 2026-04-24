import {
  headerAssertion,
  jsonBodyAssertion,
  recordAssertion,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import { NotFoundError } from "@openstatus/services";
import {
  type CreateMonitorInput,
  type UpdateMonitorGeneralInput,
  bulkUpdateMonitors,
  cloneMonitor,
  createMonitor,
  deleteMonitor,
  deleteMonitors,
  getMonitor,
  listMonitors,
  monitorJobTypes,
  monitorMethods,
  monitorPeriodicity,
  updateMonitorFollowRedirects,
  updateMonitorGeneral,
  updateMonitorNotifiers,
  updateMonitorOtel,
  updateMonitorPublic,
  updateMonitorResponseTime,
  updateMonitorRetry,
  updateMonitorSchedulingRegions,
  updateMonitorTags,
} from "@openstatus/services/monitor";
import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { testDns, testHttp, testTcp } from "./checker";

// tRPC-side input schemas. These preserve the existing wire contract exactly.

const headerPair = z.object({ key: z.string(), value: z.string() });
const assertionUnion = z.discriminatedUnion("type", [
  statusAssertion,
  headerAssertion,
  textBodyAssertion,
  jsonBodyAssertion,
  recordAssertion,
]);

const newMonitorTRPCInput = z.object({
  name: z.string(),
  jobType: z.enum(monitorJobTypes),
  url: z.string(),
  method: z.enum(monitorMethods),
  headers: z.array(headerPair),
  body: z.string().optional(),
  assertions: z.array(assertionUnion),
  active: z.boolean().prefault(false),
  saveCheck: z.boolean().prefault(false),
  skipCheck: z.boolean().prefault(false),
});

const updateGeneralTRPCInput = z.object({
  id: z.number(),
  jobType: z.enum(monitorJobTypes),
  url: z.string(),
  method: z.enum(monitorMethods),
  headers: z.array(headerPair),
  body: z.string().optional(),
  name: z.string(),
  assertions: z.array(assertionUnion),
  active: z.boolean().prefault(true),
  skipCheck: z.boolean().prefault(true),
  saveCheck: z.boolean().prefault(false),
});

export const monitorRouter = createTRPCRouter({
  delete: protectedProcedure
    .meta({ track: Events.DeleteMonitor })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMonitor({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        // Preserve the pre-migration idempotent behaviour — old code
        // silently returned when the row was already gone.
        if (err instanceof NotFoundError) return;
        toTRPCError(err);
      }
    }),

  deleteMonitors: protectedProcedure
    .input(z.object({ ids: z.number().array() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMonitors({
          ctx: toServiceCtx(ctx),
          input: { ids: input.ids },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateMonitors: protectedProcedure
    .input(
      z.object({
        ids: z.number().array(),
        public: z.boolean().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await bulkUpdateMonitors({
          ctx: toServiceCtx(ctx),
          input: {
            ids: input.ids,
            public: input.public,
            active: input.active,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  list: protectedProcedure
    .input(z.object({ order: z.enum(["asc", "desc"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const { items } = await listMonitors({
          ctx: toServiceCtx(ctx),
          input: {
            // tRPC consumers (dashboard) want the full set; no paging UI.
            limit: 10_000,
            offset: 0,
            order: input?.order ?? "desc",
          },
        });
        return items;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.coerce.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitor({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  clone: protectedProcedure
    .meta({ track: Events.CloneMonitor })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await cloneMonitor({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateRetry: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), retry: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorRetry({
          ctx: toServiceCtx(ctx),
          input: { id: input.id, retry: input.retry },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateFollowRedirects: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), followRedirects: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorFollowRedirects({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            followRedirects: input.followRedirects,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateOtel: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(
      z.object({
        id: z.number(),
        otelEndpoint: z.string(),
        otelHeaders: z.array(headerPair).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorOtel({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            otelEndpoint: input.otelEndpoint,
            otelHeaders: input.otelHeaders,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updatePublic: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), public: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorPublic({
          ctx: toServiceCtx(ctx),
          input: { id: input.id, public: input.public },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateSchedulingRegions: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(
      z.object({
        id: z.number(),
        regions: z.array(z.string()),
        periodicity: z.enum(monitorPeriodicity),
        privateLocations: z.array(z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorSchedulingRegions({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            regions: input.regions,
            periodicity: input.periodicity,
            privateLocations: input.privateLocations,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateResponseTime: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(
      z.object({
        id: z.number(),
        timeout: z.number(),
        degradedAfter: z.number().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorResponseTime({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            timeout: input.timeout,
            degradedAfter: input.degradedAfter,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateTags: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), tags: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorTags({
          ctx: toServiceCtx(ctx),
          input: { id: input.id, tags: input.tags },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateGeneral: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(updateGeneralTRPCInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Pre-save endpoint check — kept at the tRPC layer because the
        // `testHttp` / `testTcp` / `testDns` helpers hit external URLs and
        // are tRPC-specific UX; services unconditionally save.
        if (!input.skipCheck && input.active) {
          if (input.jobType === "http") {
            await testHttp({
              url: input.url,
              method: input.method,
              headers: input.headers,
              body: input.body,
              assertions: input.assertions.filter(
                (a) => a.type !== "dnsRecord",
              ),
              region: "ams",
            });
          } else if (input.jobType === "tcp") {
            await testTcp({ url: input.url, region: "ams" });
          } else if (input.jobType === "dns") {
            await testDns({
              url: input.url,
              region: "ams",
              assertions: input.assertions.filter(
                (a) => a.type === "dnsRecord",
              ),
            });
          }
        }

        const serviceInput: UpdateMonitorGeneralInput = {
          id: input.id,
          name: input.name,
          jobType: input.jobType,
          url: input.url,
          method: input.method,
          headers: input.headers,
          body: input.body,
          assertions: input.assertions,
          active: input.active,
        };
        await updateMonitorGeneral({
          ctx: toServiceCtx(ctx),
          input: serviceInput,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateNotifiers: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), notifiers: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMonitorNotifiers({
          ctx: toServiceCtx(ctx),
          input: { id: input.id, notifiers: input.notifiers },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateMonitor, trackProps: ["url", "jobType"] })
    .input(newMonitorTRPCInput)
    .mutation(async ({ ctx, input }) => {
      try {
        if (!input.skipCheck) {
          if (input.jobType === "http") {
            await testHttp({
              url: input.url,
              method: input.method,
              headers: input.headers,
              body: input.body,
              assertions: input.assertions.filter(
                (a) => a.type !== "dnsRecord",
              ),
              region: "ams",
            });
          } else if (input.jobType === "tcp") {
            await testTcp({ url: input.url, region: "ams" });
          } else if (input.jobType === "dns") {
            await testDns({
              url: input.url,
              region: "ams",
              assertions: input.assertions.filter(
                (a) => a.type === "dnsRecord",
              ),
            });
          }
        }

        const serviceInput: CreateMonitorInput = {
          name: input.name,
          jobType: input.jobType,
          url: input.url,
          method: input.method,
          headers: input.headers,
          body: input.body,
          assertions: input.assertions,
          active: input.active,
        };
        return await createMonitor({
          ctx: toServiceCtx(ctx),
          input: serviceInput,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
