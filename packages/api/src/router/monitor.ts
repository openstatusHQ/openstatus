import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  type Assertion,
  DnsRecordAssertion,
  HeaderAssertion,
  StatusAssertion,
  TextBodyAssertion,
  headerAssertion,
  jsonBodyAssertion,
  recordAssertion,
  serialize,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import { type SQL, and, count, eq, inArray, isNull } from "@openstatus/db";
import {
  insertMonitorSchema,
  maintenancesToMonitors,
  monitor,
  monitorJobTypes,
  monitorMethods,
  monitorTag,
  monitorTagsToMonitors,
  monitorsToPages,
  monitorsToStatusReport,
  notification,
  notificationsToMonitors,
  privateLocationToMonitors,
  selectIncidentSchema,
  selectMonitorSchema,
  selectMonitorTagSchema,
  selectNotificationSchema,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import {
  freeFlyRegions,
  monitorPeriodicity,
  monitorRegions,
} from "@openstatus/db/src/schema/constants";
import { regionDict } from "@openstatus/regions";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { testDns, testHttp, testTcp } from "./checker";

export const monitorRouter = createTRPCRouter({
  delete: protectedProcedure
    .meta({ track: Events.DeleteMonitor })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const monitorToDelete = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!monitorToDelete) return;

      await opts.ctx.db
        .update(monitor)
        .set({ deletedAt: new Date(), active: false })
        .where(eq(monitor.id, monitorToDelete.id))
        .run();

      await opts.ctx.db.transaction(async (tx) => {
        await tx
          .delete(monitorsToPages)
          .where(eq(monitorsToPages.monitorId, monitorToDelete.id));
        await tx
          .delete(monitorTagsToMonitors)
          .where(eq(monitorTagsToMonitors.monitorId, monitorToDelete.id));
        await tx
          .delete(monitorsToStatusReport)
          .where(eq(monitorsToStatusReport.monitorId, monitorToDelete.id));
        await tx
          .delete(notificationsToMonitors)
          .where(eq(notificationsToMonitors.monitorId, monitorToDelete.id));
        await tx
          .delete(maintenancesToMonitors)
          .where(eq(maintenancesToMonitors.monitorId, monitorToDelete.id));
      });
    }),

  deleteMonitors: protectedProcedure
    .input(z.object({ ids: z.number().array() }))
    .mutation(async (opts) => {
      const _monitors = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            inArray(monitor.id, opts.input.ids),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .all();

      if (_monitors.length !== opts.input.ids.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found.",
        });
      }

      await opts.ctx.db
        .update(monitor)
        .set({ deletedAt: new Date(), active: false })
        .where(inArray(monitor.id, opts.input.ids))
        .run();

      await opts.ctx.db.transaction(async (tx) => {
        await tx
          .delete(monitorsToPages)
          .where(inArray(monitorsToPages.monitorId, opts.input.ids));
        await tx
          .delete(monitorTagsToMonitors)
          .where(inArray(monitorTagsToMonitors.monitorId, opts.input.ids));
        await tx
          .delete(monitorsToStatusReport)
          .where(inArray(monitorsToStatusReport.monitorId, opts.input.ids));
        await tx
          .delete(notificationsToMonitors)
          .where(inArray(notificationsToMonitors.monitorId, opts.input.ids));
        await tx
          .delete(maintenancesToMonitors)
          .where(inArray(maintenancesToMonitors.monitorId, opts.input.ids));
      });
    }),

  updateMonitors: protectedProcedure
    .input(
      insertMonitorSchema
        .pick({ public: true, active: true })
        .partial() // batched updates
        .extend({ ids: z.number().array() }), // array of monitor ids to update
    )
    .mutation(async (opts) => {
      await opts.ctx.db
        .update(monitor)
        .set(opts.input)
        .where(
          and(
            inArray(monitor.id, opts.input.ids),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        );
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(monitor.workspaceId, opts.ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      const result = await opts.ctx.db.query.monitor.findMany({
        where: and(...whereConditions),
        with: {
          monitorTagsToMonitors: {
            with: { monitorTag: true },
          },
          incidents: {
            orderBy: (incident, { desc }) => [desc(incident.createdAt)],
          },
        },
        orderBy: (monitor, { asc, desc }) =>
          opts.input?.order === "asc"
            ? [asc(monitor.active), asc(monitor.createdAt)]
            : [desc(monitor.active), desc(monitor.createdAt)],
      });

      return z
        .array(
          selectMonitorSchema.extend({
            tags: z.array(selectMonitorTagSchema).prefault([]),
            incidents: z.array(selectIncidentSchema).prefault([]),
          }),
        )
        .parse(
          result.map((data) => ({
            ...data,
            tags: data.monitorTagsToMonitors.map((t) => t.monitorTag),
          })),
        );
    }),

  get: protectedProcedure
    .input(z.object({ id: z.coerce.number() }))
    .query(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      const data = await ctx.db.query.monitor.findFirst({
        where: and(...whereConditions),
        with: {
          monitorsToNotifications: {
            with: { notification: true },
          },
          monitorTagsToMonitors: {
            with: { monitorTag: true },
          },
          incidents: true,
          privateLocationToMonitors: {
            with: { privateLocation: true },
          },
        },
      });

      if (!data) return null;

      return selectMonitorSchema
        .extend({
          notifications: z.array(selectNotificationSchema).prefault([]),
          tags: z.array(selectMonitorTagSchema).prefault([]),
          incidents: z.array(selectIncidentSchema).prefault([]),
          privateLocations: z.array(selectPrivateLocationSchema).prefault([]),
        })
        .parse({
          ...data,
          notifications: data.monitorsToNotifications.map(
            (m) => m.notification,
          ),
          tags: data.monitorTagsToMonitors.map((t) => t.monitorTag),
          incidents: data.incidents,
          privateLocations: data.privateLocationToMonitors.map(
            (p) => p.privateLocation,
          ),
        });
    }),

  clone: protectedProcedure
    .meta({ track: Events.CloneMonitor })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      const _monitors = await ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, ctx.workspace.id),
          isNull(monitor.deletedAt),
        ),
      });

      if (_monitors.length >= ctx.workspace.limits.monitors) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have reached the maximum number of monitors.",
        });
      }

      const data = await ctx.db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found.",
        });
      }

      const [newMonitor] = await ctx.db
        .insert(monitor)
        .values({
          ...data,
          id: undefined, // let the db generate the id
          name: `${data.name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!newMonitor) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to clone monitor.",
        });
      }

      return newMonitor;
    }),

  updateRetry: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), retry: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      await ctx.db
        .update(monitor)
        .set({ retry: input.retry, updatedAt: new Date() })
        .where(and(...whereConditions))
        .run();
    }),

  updateFollowRedirects: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), followRedirects: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      await ctx.db
        .update(monitor)
        .set({
          followRedirects: input.followRedirects,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateOtel: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(
      z.object({
        id: z.number(),
        otelEndpoint: z.string(),
        otelHeaders: z
          .array(z.object({ key: z.string(), value: z.string() }))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      await ctx.db
        .update(monitor)
        .set({
          otelEndpoint: input.otelEndpoint,
          otelHeaders: input.otelHeaders
            ? JSON.stringify(input.otelHeaders)
            : undefined,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updatePublic: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), public: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      await ctx.db
        .update(monitor)
        .set({ public: input.public, updatedAt: new Date() })
        .where(and(...whereConditions))
        .run();
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
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      const limits = ctx.workspace.limits;

      if (!limits.periodicity.includes(input.periodicity)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Upgrade to check more often.",
        });
      }

      if (limits["max-regions"] < input.regions.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have reached the maximum number of regions.",
        });
      }

      if (
        input.regions.length > 0 &&
        !input.regions.every((r) =>
          limits.regions.includes(r as (typeof limits)["regions"][number]),
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this region.",
        });
      }

      const existingMonitor = await ctx.db.query.monitor.findFirst({
        where: and(...whereConditions),
      });

      if (!existingMonitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(monitor)
          .set({
            regions: input.regions.join(","),
            periodicity: input.periodicity,
            updatedAt: new Date(),
          })
          .where(and(...whereConditions))
          .run();

        await tx
          .delete(privateLocationToMonitors)
          .where(eq(privateLocationToMonitors.monitorId, input.id));

        if (input.privateLocations && input.privateLocations.length > 0) {
          await tx.insert(privateLocationToMonitors).values(
            input.privateLocations.map((privateLocationId) => ({
              monitorId: input.id,
              privateLocationId,
            })),
          );
        }
      });
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
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      await ctx.db
        .update(monitor)
        .set({
          timeout: input.timeout,
          degradedAfter: input.degradedAfter,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateTags: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), tags: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const existingMonitor = await ctx.db.query.monitor.findFirst({
        where: and(
          eq(monitor.id, input.id),
          eq(monitor.workspaceId, ctx.workspace.id),
        ),
      });

      if (!existingMonitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found.",
        });
      }

      const allTags = await ctx.db.query.monitorTag.findMany({
        where: and(
          eq(monitorTag.workspaceId, ctx.workspace.id),
          inArray(monitorTag.id, input.tags),
        ),
      });

      if (allTags.length !== input.tags.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this tag.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(monitorTagsToMonitors)
          .where(and(eq(monitorTagsToMonitors.monitorId, input.id)));

        if (input.tags.length > 0) {
          await tx.insert(monitorTagsToMonitors).values(
            input.tags.map((tagId) => ({
              monitorId: input.id,
              monitorTagId: tagId,
            })),
          );
        }
      });
    }),

  updateGeneral: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(
      z.object({
        id: z.number(),
        jobType: z.enum(monitorJobTypes),
        url: z.string(),
        method: z.enum(monitorMethods),
        headers: z.array(z.object({ key: z.string(), value: z.string() })),
        body: z.string().optional(),
        name: z.string(),
        assertions: z.array(
          z.discriminatedUnion("type", [
            statusAssertion,
            headerAssertion,
            textBodyAssertion,
            jsonBodyAssertion,
            recordAssertion,
          ]),
        ),
        active: z.boolean().prefault(true),
        // skip the test check if assertions are OK
        skipCheck: z.boolean().prefault(true),
        // save check in db (iff success? -> e.g. onboarding to get a first ping)
        saveCheck: z.boolean().prefault(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const whereConditions: SQL[] = [
        eq(monitor.id, input.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ];

      const assertions: Assertion[] = [];
      for (const a of input.assertions ?? []) {
        if (a.type === "status") {
          assertions.push(new StatusAssertion(a));
        }
        if (a.type === "header") {
          assertions.push(new HeaderAssertion(a));
        }
        if (a.type === "textBody") {
          assertions.push(new TextBodyAssertion(a));
        }
        if (a.type === "dnsRecord") {
          assertions.push(new DnsRecordAssertion(a));
        }
      }

      // NOTE: we are checking the endpoint before saving
      if (!input.skipCheck && input.active) {
        if (input.jobType === "http") {
          await testHttp({
            url: input.url,
            method: input.method,
            headers: input.headers,
            body: input.body,
            // Filter out DNS record assertions as they can't be validated via HTTP
            assertions: input.assertions.filter((a) => a.type !== "dnsRecord"),
            region: "ams",
          });
        } else if (input.jobType === "tcp") {
          await testTcp({
            url: input.url,
            region: "ams",
          });
        } else if (input.jobType === "dns") {
          await testDns({
            url: input.url,
            region: "ams",
            assertions: input.assertions.filter((a) => a.type === "dnsRecord"),
          });
        }
      }

      await ctx.db
        .update(monitor)
        .set({
          name: input.name,
          jobType: input.jobType,
          url: input.url,
          method: input.method,
          headers: input.headers ? JSON.stringify(input.headers) : undefined,
          body: input.body,
          active: input.active,
          assertions: serialize(assertions),
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateNotifiers: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(z.object({ id: z.number(), notifiers: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const existingMonitor = await ctx.db.query.monitor.findFirst({
        where: and(
          eq(monitor.id, input.id),
          eq(monitor.workspaceId, ctx.workspace.id),
        ),
      });

      if (!existingMonitor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found.",
        });
      }

      const allNotifiers = await ctx.db.query.notification.findMany({
        where: and(
          eq(notification.workspaceId, ctx.workspace.id),
          inArray(notification.id, input.notifiers),
        ),
      });

      if (allNotifiers.length !== input.notifiers.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this notifier.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(notificationsToMonitors)
          .where(and(eq(notificationsToMonitors.monitorId, input.id)));

        if (input.notifiers.length > 0) {
          await tx.insert(notificationsToMonitors).values(
            input.notifiers.map((notifierId) => ({
              monitorId: input.id,
              notificationId: notifierId,
            })),
          );
        }
      });
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateMonitor, trackProps: ["url", "jobType"] })
    .input(
      z.object({
        name: z.string(),
        jobType: z.enum(monitorJobTypes),
        url: z.string(),
        method: z.enum(monitorMethods),
        headers: z.array(z.object({ key: z.string(), value: z.string() })),
        body: z.string().optional(),
        assertions: z.array(
          z.discriminatedUnion("type", [
            statusAssertion,
            headerAssertion,
            textBodyAssertion,
            jsonBodyAssertion,
            recordAssertion,
          ]),
        ),
        active: z.boolean().prefault(false),
        saveCheck: z.boolean().prefault(false),
        skipCheck: z.boolean().prefault(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const limits = ctx.workspace.limits;

      const res = await ctx.db
        .select({ count: count() })
        .from(monitor)
        .where(
          and(
            eq(monitor.workspaceId, ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        )
        .get();

      // the user has reached the limits
      if (res && res.count >= limits.monitors) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your monitor limits.",
        });
      }

      const assertions: Assertion[] = [];
      for (const a of input.assertions ?? []) {
        if (a.type === "status") {
          assertions.push(new StatusAssertion(a));
        }
        if (a.type === "header") {
          assertions.push(new HeaderAssertion(a));
        }
        if (a.type === "textBody") {
          assertions.push(new TextBodyAssertion(a));
        }
        if (a.type === "dnsRecord") {
          assertions.push(new DnsRecordAssertion(a));
        }
      }

      // NOTE: we are checking the endpoint before saving
      if (!input.skipCheck) {
        if (input.jobType === "http") {
          await testHttp({
            url: input.url,
            method: input.method,
            headers: input.headers,
            body: input.body,
            // Filter out DNS record assertions as they can't be validated via HTTP
            assertions: input.assertions.filter((a) => a.type !== "dnsRecord"),
            region: "ams",
          });
        } else if (input.jobType === "tcp") {
          await testTcp({
            url: input.url,
            region: "ams",
          });
        } else if (input.jobType === "dns") {
          await testDns({
            url: input.url,
            region: "ams",
            assertions: input.assertions.filter((a) => a.type === "dnsRecord"),
          });
        }
      }

      const selectableRegions =
        ctx.workspace.plan === "free" ? freeFlyRegions : monitorRegions;
      const randomRegions = ctx.workspace.plan === "free" ? 4 : 6;

      const regions = [...selectableRegions]
        // NOTE: make sure we don't use deprecated regions
        .filter((r) => {
          const deprecated = regionDict[r].deprecated;
          if (!deprecated) return true;
          return false;
        })
        .sort(() => 0.5 - Math.random())
        .slice(0, randomRegions);

      const newMonitor = await ctx.db
        .insert(monitor)
        .values({
          name: input.name,
          jobType: input.jobType,
          url: input.url,
          method: input.method,
          headers: input.headers ? JSON.stringify(input.headers) : undefined,
          body: input.body,
          active: input.active,
          workspaceId: ctx.workspace.id,
          periodicity: ctx.workspace.plan === "free" ? "30m" : "1m",
          regions: regions.join(","),
          assertions: serialize(assertions),
          updatedAt: new Date(),
        })
        .returning()
        .get();

      return newMonitor;
    }),
});
