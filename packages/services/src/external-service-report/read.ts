import {
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  sql,
} from "@openstatus/db";
import { externalServiceReport } from "@openstatus/db/src/schema";

import type { GlobalReadContext } from "../external-service/internal";
import { retryRead } from "../retry";

export type ServiceReportWindow = {
  externalServiceId: number;
  reporters: number;
  total: number;
  countries: number;
};

export type ComponentReportWindow = {
  componentId: number;
  reporters: number;
  total: number;
};

export type DailyReport = { day: string; reporters: number; total: number };

export type CountryReport = { country: string; total: number };

const distinctReporters = sql<number>`count(distinct ${externalServiceReport.reporterHash})`;
const totalReports = sql<number>`count(*)`;
const distinctCountries = sql<number>`count(distinct case when ${externalServiceReport.country} != '' then ${externalServiceReport.country} end)`;
const dayBucket = sql<string>`strftime('%Y-%m-%d', ${externalServiceReport.createdAt}, 'unixepoch')`;

export async function getServiceReportWindows(args: {
  ctx?: GlobalReadContext;
  serviceIds: number[];
  since: Date;
}): Promise<ServiceReportWindow[]> {
  const { ctx, serviceIds, since } = args;
  if (serviceIds.length === 0) return [];
  const db = ctx?.db ?? defaultDb;
  return retryRead(() =>
    db
      .select({
        externalServiceId: externalServiceReport.externalServiceId,
        reporters: distinctReporters,
        total: totalReports,
        countries: distinctCountries,
      })
      .from(externalServiceReport)
      .where(
        and(
          inArray(externalServiceReport.externalServiceId, serviceIds),
          gte(externalServiceReport.createdAt, since),
        ),
      )
      .groupBy(externalServiceReport.externalServiceId)
      .all(),
  );
}

export async function getComponentReportWindows(args: {
  ctx?: GlobalReadContext;
  serviceId: number;
  since: Date;
}): Promise<ComponentReportWindow[]> {
  const { ctx, serviceId, since } = args;
  const db = ctx?.db ?? defaultDb;
  const rows = await retryRead(() =>
    db
      .select({
        componentId: externalServiceReport.externalServiceComponentId,
        reporters: distinctReporters,
        total: totalReports,
      })
      .from(externalServiceReport)
      .where(
        and(
          eq(externalServiceReport.externalServiceId, serviceId),
          isNotNull(externalServiceReport.externalServiceComponentId),
          gte(externalServiceReport.createdAt, since),
        ),
      )
      .groupBy(externalServiceReport.externalServiceComponentId)
      .all(),
  );
  return rows.flatMap((r) =>
    r.componentId == null
      ? []
      : [
          {
            componentId: r.componentId,
            reporters: r.reporters,
            total: r.total,
          },
        ],
  );
}

export async function getServiceReportDaily(args: {
  ctx?: GlobalReadContext;
  serviceId: number;
  since: Date;
}): Promise<DailyReport[]> {
  const { ctx, serviceId, since } = args;
  const db = ctx?.db ?? defaultDb;
  return db
    .select({
      day: dayBucket,
      reporters: distinctReporters,
      total: totalReports,
    })
    .from(externalServiceReport)
    .where(
      and(
        eq(externalServiceReport.externalServiceId, serviceId),
        gte(externalServiceReport.createdAt, since),
      ),
    )
    .groupBy(dayBucket)
    .orderBy(asc(dayBucket))
    .all();
}

export async function getServiceReportCountries(args: {
  ctx?: GlobalReadContext;
  serviceId: number;
  since: Date;
  limit: number;
}): Promise<CountryReport[]> {
  const { ctx, serviceId, since } = args;
  const limit = Math.max(0, Math.trunc(args.limit));
  const db = ctx?.db ?? defaultDb;
  return db
    .select({ country: externalServiceReport.country, total: totalReports })
    .from(externalServiceReport)
    .where(
      and(
        eq(externalServiceReport.externalServiceId, serviceId),
        gte(externalServiceReport.createdAt, since),
        sql`${externalServiceReport.country} != ''`,
      ),
    )
    .groupBy(externalServiceReport.country)
    .orderBy(desc(totalReports), asc(externalServiceReport.country))
    .limit(limit)
    .all();
}
