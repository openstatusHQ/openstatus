import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  type Assertion,
  HeaderAssertion,
  StatusAssertion,
  TextBodyAssertion,
  headerAssertion,
  jsonBodyAssertion,
  serialize,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  type SQL,
  sql,
} from "@openstatus/db";
import {
  incidentTable,
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
  page,
  selectIncidentSchema,
  selectMaintenanceSchema,
  selectMonitorSchema,
  selectMonitorStatusSchema,
  selectMonitorTagSchema,
  selectNotificationSchema,
  selectPageSchema,
  selectPublicMonitorSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  freeFlyRegions,
  flyRegions,
  monitorPeriodicity,
} from "@openstatus/db/src/schema/constants";
import { checkerRouter, testHttp, testTcp } from "./checker";

export const monitorRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateMonitor, trackProps: ["url", "jobType"] })
    .input(insertMonitorSchema)
    .output(selectMonitorSchema)
    .mutation(async (opts) => {
      const monitorLimit = opts.ctx.workspace.limits.monitors;
      const periodicityLimit = opts.ctx.workspace.limits.periodicity;
      const regionsLimit = opts.ctx.workspace.limits.regions;

      const monitorNumbers = (
        await opts.ctx.db.query.monitor.findMany({
          where: and(
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt)
          ),
        })
      ).length;

      // the user has reached the limits
      if (monitorNumbers >= monitorLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your monitor limits.",
        });
      }

      // the user is not allowed to use the cron job
      if (
        opts.input.periodicity &&
        !periodicityLimit.includes(opts.input.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }

      if (
        opts.input.regions !== undefined &&
        opts.input.regions?.length !== 0
      ) {
        for (const region of opts.input.regions) {
          if (!regionsLimit.includes(region)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this region.",
            });
          }
        }
      }

      // FIXME: this is a hotfix
      const {
        regions,
        headers,
        notifications,
        id,
        pages,
        tags,
        statusAssertions,
        headerAssertions,
        textBodyAssertions,
        otelHeaders,
        ...data
      } = opts.input;

      const assertions: Assertion[] = [];
      for (const a of statusAssertions ?? []) {
        assertions.push(new StatusAssertion(a));
      }
      for (const a of headerAssertions ?? []) {
        assertions.push(new HeaderAssertion(a));
      }
      for (const a of textBodyAssertions ?? []) {
        assertions.push(new TextBodyAssertion(a));
      }

      const newMonitor = await opts.ctx.db
        .insert(monitor)
        .values({
          // REMINDER: We should explicitly pass the corresponding attributes
          // otherwise, unexpected attributes will be passed
          ...data,
          workspaceId: opts.ctx.workspace.id,
          regions: regions?.join(","),
          headers: headers ? JSON.stringify(headers) : undefined,
          otelHeaders: otelHeaders ? JSON.stringify(otelHeaders) : undefined,
          assertions: assertions.length > 0 ? serialize(assertions) : undefined,
        })
        .returning()
        .get();

      if (notifications.length > 0) {
        const allNotifications = await opts.ctx.db.query.notification.findMany({
          where: and(
            eq(notification.workspaceId, opts.ctx.workspace.id),
            inArray(notification.id, notifications)
          ),
        });

        const values = allNotifications.map((notification) => ({
          monitorId: newMonitor.id,
          notificationId: notification.id,
        }));

        await opts.ctx.db.insert(notificationsToMonitors).values(values).run();
      }

      if (tags.length > 0) {
        const allTags = await opts.ctx.db.query.monitorTag.findMany({
          where: and(
            eq(monitorTag.workspaceId, opts.ctx.workspace.id),
            inArray(monitorTag.id, tags)
          ),
        });

        const values = allTags.map((monitorTag) => ({
          monitorId: newMonitor.id,
          monitorTagId: monitorTag.id,
        }));

        await opts.ctx.db.insert(monitorTagsToMonitors).values(values).run();
      }

      if (pages.length > 0) {
        const allPages = await opts.ctx.db.query.page.findMany({
          where: and(
            eq(page.workspaceId, opts.ctx.workspace.id),
            inArray(page.id, pages)
          ),
        });

        const values = allPages.map((page) => ({
          monitorId: newMonitor.id,
          pageId: page.id,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      return selectMonitorSchema.parse(newMonitor);
    }),

  getMonitorById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _monitor = await opts.ctx.db.query.monitor.findFirst({
        where: and(
          eq(monitor.id, opts.input.id),
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          isNull(monitor.deletedAt)
        ),
        with: {
          monitorTagsToMonitors: { with: { monitorTag: true } },
          maintenancesToMonitors: {
            with: { maintenance: true },
            where: eq(maintenancesToMonitors.monitorId, opts.input.id),
          },
          monitorsToNotifications: { with: { notification: true } },
        },
      });

      const parsedMonitor = selectMonitorSchema
        .extend({
          monitorTagsToMonitors: z
            .object({
              monitorTag: selectMonitorTagSchema,
            })
            .array(),
          maintenance: z.boolean().default(false).optional(),
          monitorsToNotifications: z
            .object({
              notification: selectNotificationSchema,
            })
            .array(),
        })
        .safeParse({
          ..._monitor,
          maintenance: _monitor?.maintenancesToMonitors.some(
            (item) =>
              item.maintenance.from.getTime() <= Date.now() &&
              item.maintenance.to.getTime() >= Date.now()
          ),
        });

      if (!parsedMonitor.success) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not allowed to access the monitor.",
        });
      }
      return parsedMonitor.data;
    }),

  getPublicMonitorById: publicProcedure
    // REMINDER: if on status page, we should check if the monitor is associated with the page
    // otherwise, using `/public` we don't need to check
    .input(z.object({ id: z.number(), slug: z.string().optional() }))
    .query(async (opts) => {
      const _monitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.id, opts.input.id),
            isNull(monitor.deletedAt),
            eq(monitor.public, true)
          )
        )
        .get();

      if (!_monitor) return undefined;

      if (opts.input.slug) {
        const _page = await opts.ctx.db.query.page.findFirst({
          where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
          with: { monitorsToPages: true },
        });

        const hasPageRelation = _page?.monitorsToPages.find(
          ({ monitorId }) => _monitor.id === monitorId
        );

        if (!hasPageRelation) return undefined;
      }

      return selectPublicMonitorSchema.parse(_monitor);
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateMonitor })
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;

      const periodicityLimit = opts.ctx.workspace.limits.periodicity;

      const regionsLimit = opts.ctx.workspace.limits.regions;

      // the user is not allowed to use the cron job
      if (
        opts.input?.periodicity &&
        !periodicityLimit.includes(opts.input?.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }

      if (
        opts.input.regions !== undefined &&
        opts.input.regions?.length !== 0
      ) {
        for (const region of opts.input.regions) {
          if (!regionsLimit.includes(region)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this region.",
            });
          }
        }
      }

      const {
        regions,
        headers,
        notifications,
        pages,
        tags,
        statusAssertions,
        headerAssertions,
        textBodyAssertions,
        otelHeaders,

        ...data
      } = opts.input;

      const assertions: Assertion[] = [];
      for (const a of statusAssertions ?? []) {
        assertions.push(new StatusAssertion(a));
      }
      for (const a of headerAssertions ?? []) {
        assertions.push(new HeaderAssertion(a));
      }
      for (const a of textBodyAssertions ?? []) {
        assertions.push(new TextBodyAssertion(a));
      }

      const currentMonitor = await opts.ctx.db
        .update(monitor)
        .set({
          ...data,
          regions: regions?.join(","),
          updatedAt: new Date(),
          headers: headers ? JSON.stringify(headers) : undefined,
          otelHeaders: otelHeaders ? JSON.stringify(otelHeaders) : undefined,
          assertions: serialize(assertions),
        })
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt)
          )
        )
        .returning()
        .get();

      console.log({
        currentMonitor,
        id: opts.input.id,
        workspaceId: opts.ctx.workspace.id,
      });

      const currentMonitorNotifications = await opts.ctx.db
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.monitorId, currentMonitor.id))
        .all();

      const addedNotifications = notifications.filter(
        (x) =>
          !currentMonitorNotifications
            .map(({ notificationId }) => notificationId)
            ?.includes(x)
      );

      if (addedNotifications.length > 0) {
        const values = addedNotifications.map((notificationId) => ({
          monitorId: currentMonitor.id,
          notificationId,
        }));

        await opts.ctx.db.insert(notificationsToMonitors).values(values).run();
      }

      const removedNotifications = currentMonitorNotifications
        .map(({ notificationId }) => notificationId)
        .filter((x) => !notifications?.includes(x));

      if (removedNotifications.length > 0) {
        await opts.ctx.db
          .delete(notificationsToMonitors)
          .where(
            and(
              eq(notificationsToMonitors.monitorId, currentMonitor.id),
              inArray(
                notificationsToMonitors.notificationId,
                removedNotifications
              )
            )
          )
          .run();
      }

      const currentMonitorTags = await opts.ctx.db
        .select()
        .from(monitorTagsToMonitors)
        .where(eq(monitorTagsToMonitors.monitorId, currentMonitor.id))
        .all();

      const addedTags = tags.filter(
        (x) =>
          !currentMonitorTags
            .map(({ monitorTagId }) => monitorTagId)
            ?.includes(x)
      );

      if (addedTags.length > 0) {
        const values = addedTags.map((monitorTagId) => ({
          monitorId: currentMonitor.id,
          monitorTagId,
        }));

        await opts.ctx.db.insert(monitorTagsToMonitors).values(values).run();
      }

      const removedTags = currentMonitorTags
        .map(({ monitorTagId }) => monitorTagId)
        .filter((x) => !tags?.includes(x));

      if (removedTags.length > 0) {
        await opts.ctx.db
          .delete(monitorTagsToMonitors)
          .where(
            and(
              eq(monitorTagsToMonitors.monitorId, currentMonitor.id),
              inArray(monitorTagsToMonitors.monitorTagId, removedTags)
            )
          )
          .run();
      }

      const currentMonitorPages = await opts.ctx.db
        .select()
        .from(monitorsToPages)
        .where(eq(monitorsToPages.monitorId, currentMonitor.id))
        .all();

      const addedPages = pages.filter(
        (x) => !currentMonitorPages.map(({ pageId }) => pageId)?.includes(x)
      );

      if (addedPages.length > 0) {
        const values = addedPages.map((pageId) => ({
          monitorId: currentMonitor.id,
          pageId,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      const removedPages = currentMonitorPages
        .map(({ pageId }) => pageId)
        .filter((x) => !pages?.includes(x));

      if (removedPages.length > 0) {
        await opts.ctx.db
          .delete(monitorsToPages)
          .where(
            and(
              eq(monitorsToPages.monitorId, currentMonitor.id),
              inArray(monitorsToPages.pageId, removedPages)
            )
          )
          .run();
      }
    }),

  updateMonitors: protectedProcedure
    .input(
      insertMonitorSchema
        .pick({ public: true, active: true })
        .partial() // batched updates
        .extend({ ids: z.number().array() }) // array of monitor ids to update
    )
    .mutation(async (opts) => {
      const _monitors = await opts.ctx.db
        .update(monitor)
        .set(opts.input)
        .where(
          and(
            inArray(monitor.id, opts.input.ids),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt)
          )
        );
    }),

  updateMonitorsTag: protectedProcedure
    .input(
      z.object({
        ids: z.number().array(),
        tagId: z.number(),
        action: z.enum(["add", "remove"]),
      })
    )
    .mutation(async (opts) => {
      const _monitorTag = await opts.ctx.db.query.monitorTag.findFirst({
        where: and(
          eq(monitorTag.workspaceId, opts.ctx.workspace.id),
          eq(monitorTag.id, opts.input.tagId)
        ),
      });

      const _monitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          inArray(monitor.id, opts.input.ids)
        ),
      });

      if (!_monitorTag || _monitors.length !== opts.input.ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid tag",
        });
      }

      if (opts.input.action === "add") {
        await opts.ctx.db
          .insert(monitorTagsToMonitors)
          .values(
            opts.input.ids.map((id) => ({
              monitorId: id,
              monitorTagId: opts.input.tagId,
            }))
          )
          .onConflictDoNothing()
          .run();
      }

      if (opts.input.action === "remove") {
        await opts.ctx.db
          .delete(monitorTagsToMonitors)
          .where(
            and(
              inArray(monitorTagsToMonitors.monitorId, opts.input.ids),
              eq(monitorTagsToMonitors.monitorTagId, opts.input.tagId)
            )
          )
          .run();
      }
    }),

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
            eq(monitor.workspaceId, opts.ctx.workspace.id)
          )
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
            eq(monitor.workspaceId, opts.ctx.workspace.id)
          )
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

  getMonitorsByWorkspace: protectedProcedure.query(async (opts) => {
    const monitors = await opts.ctx.db.query.monitor.findMany({
      where: and(
        eq(monitor.workspaceId, opts.ctx.workspace.id),
        isNull(monitor.deletedAt)
      ),
      with: {
        monitorTagsToMonitors: { with: { monitorTag: true } },
      },
      orderBy: (monitor, { desc }) => [desc(monitor.active)],
    });

    return z
      .array(
        selectMonitorSchema.extend({
          monitorTagsToMonitors: z
            .array(z.object({ monitorTag: selectMonitorTagSchema }))
            .default([]),
        })
      )
      .parse(monitors);
  }),

  getMonitorsByPageId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.id),
          eq(page.workspaceId, opts.ctx.workspace.id)
        ),
      });

      if (!_page) return undefined;

      const monitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          isNull(monitor.deletedAt)
        ),
        with: {
          monitorTagsToMonitors: { with: { monitorTag: true } },
          monitorsToPages: {
            where: eq(monitorsToPages.pageId, _page.id),
          },
        },
      });

      return z
        .array(
          selectMonitorSchema.extend({
            monitorTagsToMonitors: z
              .array(z.object({ monitorTag: selectMonitorTagSchema }))
              .default([]),
          })
        )
        .parse(
          monitors.filter((monitor) =>
            monitor.monitorsToPages
              .map(({ pageId }) => pageId)
              .includes(_page.id)
          )
        );
    }),

  toggleMonitorActive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const monitorToUpdate = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt)
          )
        )
        .get();

      if (!monitorToUpdate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Monitor not found.",
        });
      }

      await opts.ctx.db
        .update(monitor)
        .set({
          active: !monitorToUpdate.active,
        })
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id)
          )
        )
        .run();
    }),

  // rename to getActiveMonitorsCount
  getTotalActiveMonitors: publicProcedure.query(async (opts) => {
    const monitors = await opts.ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(monitor)
      .where(eq(monitor.active, true))
      .all();
    if (monitors.length === 0) return 0;
    return monitors[0].count;
  }),

  // TODO: return the notifications inside of the `getMonitorById` like we do for the monitors on a status page
  getAllNotificationsForMonitor: protectedProcedure
    .input(z.object({ id: z.number() }))
    // .output(selectMonitorSchema)
    .query(async (opts) => {
      const data = await opts.ctx.db
        .select()
        .from(notificationsToMonitors)
        .innerJoin(
          notification,
          and(
            eq(notificationsToMonitors.notificationId, notification.id),
            eq(notification.workspaceId, opts.ctx.workspace.id)
          )
        )
        .where(eq(notificationsToMonitors.monitorId, opts.input.id))
        .all();
      return data.map((d) => selectNotificationSchema.parse(d.notification));
    }),

  isMonitorLimitReached: protectedProcedure.query(async (opts) => {
    const monitorLimit = opts.ctx.workspace.limits.monitors;
    const monitorNumbers = (
      await opts.ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          isNull(monitor.deletedAt)
        ),
      })
    ).length;

    return monitorNumbers >= monitorLimit;
  }),
  getMonitorRelationsById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _monitor = await opts.ctx.db.query.monitor.findFirst({
        where: and(
          eq(monitor.id, opts.input.id),
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          isNull(monitor.deletedAt)
        ),
        with: {
          monitorTagsToMonitors: true,
          monitorsToNotifications: true,
          monitorsToPages: true,
        },
      });

      const parsedMonitorNotification = _monitor?.monitorsToNotifications.map(
        ({ notificationId }) => notificationId
      );
      const parsedPages = _monitor?.monitorsToPages.map((val) => val.pageId);
      const parsedTags = _monitor?.monitorTagsToMonitors.map(
        ({ monitorTagId }) => monitorTagId
      );

      return {
        notificationIds: parsedMonitorNotification,
        pageIds: parsedPages,
        monitorTagIds: parsedTags,
      };
    }),

  // DASHBOARD

  list: protectedProcedure
    .input(
      z
        .object({
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional()
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
            tags: z.array(selectMonitorTagSchema).default([]),
            incidents: z.array(selectIncidentSchema).default([]),
          })
        )
        .parse(
          result.map((data) => ({
            ...data,
            tags: data.monitorTagsToMonitors.map((t) => t.monitorTag),
          }))
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
          monitorsToPages: {
            with: { page: true },
          },
          monitorTagsToMonitors: {
            with: { monitorTag: true },
          },
          maintenancesToMonitors: {
            with: { maintenance: true },
          },
          incidents: true,
        },
      });

      if (!data) return null;

      return selectMonitorSchema
        .extend({
          notifications: z.array(selectNotificationSchema).default([]),
          pages: z.array(selectPageSchema).default([]),
          tags: z.array(selectMonitorTagSchema).default([]),
          maintenances: z.array(selectMaintenanceSchema).default([]),
          incidents: z.array(selectIncidentSchema).default([]),
        })
        .parse({
          ...data,
          notifications: data.monitorsToNotifications.map(
            (m) => m.notification
          ),
          pages: data.monitorsToPages.map((p) => p.page),
          tags: data.monitorTagsToMonitors.map((t) => t.monitorTag),
          maintenances: data.maintenancesToMonitors.map((m) => m.maintenance),
          incidents: data.incidents,
        });
    }),

  clone: protectedProcedure
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
          isNull(monitor.deletedAt)
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

  updateOtel: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        otelEndpoint: z.string(),
        otelHeaders: z
          .array(z.object({ key: z.string(), value: z.string() }))
          .optional(),
      })
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
    .input(
      z.object({
        id: z.number(),
        regions: z.array(z.string()),
        periodicity: z.enum(monitorPeriodicity),
      })
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

      console.log(input.regions, limits["regions"]);

      if (
        input.regions.length > 0 &&
        !input.regions.every((r) =>
          limits["regions"].includes(r as (typeof limits)["regions"][number])
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this region.",
        });
      }

      await ctx.db
        .update(monitor)
        .set({
          regions: input.regions.join(","),
          periodicity: input.periodicity,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .run();
    }),

  updateResponseTime: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        timeout: z.number(),
        degradedAfter: z.number().optional(),
      })
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
    .input(z.object({ id: z.number(), tags: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const allTags = await ctx.db.query.monitorTag.findMany({
        where: and(
          eq(monitorTag.workspaceId, ctx.workspace.id),
          inArray(monitorTag.id, input.tags)
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
            }))
          );
        }
      });
    }),

  updateStatusPages: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        statusPages: z.array(z.number()),
        // TODO: add custom name for monitor, shown on status page, requires db migration
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allPages = await ctx.db.query.page.findMany({
        where: and(
          eq(page.workspaceId, ctx.workspace.id),
          inArray(page.id, input.statusPages)
        ),
      });

      if (allPages.length !== input.statusPages.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this status page.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(monitorsToPages)
          .where(and(eq(monitorsToPages.monitorId, input.id)));

        if (input.statusPages.length > 0) {
          await tx.insert(monitorsToPages).values(
            input.statusPages.map((pageId) => ({
              monitorId: input.id,
              pageId,
            }))
          );
        }

        if (input.description) {
          await tx
            .update(monitor)
            .set({ description: input.description, updatedAt: new Date() })
            .where(and(eq(monitor.id, input.id)));
        }
      });
    }),

  updateGeneral: protectedProcedure
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
          ])
        ),
        active: z.boolean().default(true),
        // skip the test check if assertions are OK
        skipCheck: z.boolean().default(true),
        // save check in db (iff success? -> e.g. onboarding to get a first ping)
        saveCheck: z.boolean().default(false),
      })
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
      }

      // NOTE: we are checking the endpoint before saving
      if (!input.skipCheck) {
        if (input.jobType === "http") {
          await testHttp({
            url: input.url,
            method: input.method,
            headers: input.headers,
            body: input.body,
            assertions: input.assertions,
            region: "ams",
          });
        } else if (input.jobType === "tcp") {
          await testTcp({
            url: input.url,
            region: "ams",
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
    .input(z.object({ id: z.number(), notifiers: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const allNotifiers = await ctx.db.query.notification.findMany({
        where: and(
          eq(notification.workspaceId, ctx.workspace.id),
          inArray(notification.id, input.notifiers)
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
            }))
          );
        }
      });
    }),

  new: protectedProcedure
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
          ])
        ),
        active: z.boolean().default(false),
        saveCheck: z.boolean().default(false),
        skipCheck: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const limits = ctx.workspace.limits;

      const res = await ctx.db
        .select({ count: count() })
        .from(monitor)
        .where(
          and(
            eq(monitor.workspaceId, ctx.workspace.id),
            isNull(monitor.deletedAt)
          )
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
      }

      // NOTE: we are checking the endpoint before saving
      if (!input.skipCheck) {
        if (input.jobType === "http") {
          await testHttp({
            url: input.url,
            method: input.method,
            headers: input.headers,
            body: input.body,
            assertions: input.assertions,
            region: "ams",
          });
        } else if (input.jobType === "tcp") {
          await testTcp({
            url: input.url,
            region: "ams",
          });
        }
      }

      const selectableRegions =
        ctx.workspace.plan === "free" ? freeFlyRegions : flyRegions;
      const randomRegions = ctx.workspace.plan === "free" ? 4 : 6;

      const regions = [...selectableRegions]
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
          periodicity: "30m",
          regions: regions.join(","),
          assertions: serialize(assertions),
          updatedAt: new Date(),
        })
        .returning()
        .get();

      return newMonitor;
    }),
});
