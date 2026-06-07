import { CloudTasksClient } from "@google-cloud/tasks";
import type { google } from "@google-cloud/tasks/build/protos/protos";
import type { Database } from "@tursodatabase/sync";
import { Effect, Either, Schedule } from "effect";
import { z } from "zod";

import {
  type MonitorStatus,
  selectMonitorSchema,
  selectMonitorStatusSchema,
} from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import { regionDict } from "@openstatus/regions";
import { getDb } from "../lib/db";

import { getLogger } from "@logtape/logtape";
import type { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import {
  type DNSPayloadSchema,
  type httpPayloadSchema,
  type tpcPayloadSchema,
  transformHeaders,
} from "@openstatus/utils";
import { env } from "../env";
import { reportBackgroundError } from "../lib/sentry";

type TaskInput = {
  row: z.infer<typeof selectMonitorSchema>;
  timestamp: number;
  status: MonitorStatus;
  region: Region;
};

export const isAuthorizedDomain = (url: string) => {
  return url.includes(env().SITE_URL);
};

const logger = getLogger("workflow");

const client = new CloudTasksClient({
  fallback: "rest",
  projectId: env().GCP_PROJECT_ID,
  credentials: {
    client_email: env().GCP_CLIENT_EMAIL,
    private_key: env().GCP_PRIVATE_KEY.replaceAll("\\n", "\n"),
  },
});

type SqlValue = string | number | null;

interface PreparedStatement<TRow> {
  all(...bindParameters: SqlValue[]): Promise<TRow[]>;
}

type MonitorRow = {
  id: number;
  jobType: string;
  periodicity: string;
  status: string;
  active: number;
  regions: string;
  url: string;
  name: string;
  externalName: string | null;
  description: string;
  headers: string | null;
  body: string | null;
  method: string | null;
  workspaceId: number | null;
  timeout: number;
  degradedAfter: number | null;
  assertions: string | null;
  otelEndpoint: string | null;
  otelHeaders: string | null;
  public: number | null;
  retry: number | null;
  followRedirects: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  deletedAt: number | null;
};

type MonitorStatusRow = {
  monitorId: number;
  region: string;
  status: string;
  createdAt: number | null;
  updatedAt: number | null;
};

type HydratedMonitorRow = Omit<
  MonitorRow,
  | "active"
  | "public"
  | "followRedirects"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
> & {
  active: boolean;
  public: boolean | null;
  followRedirects: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

type HydratedMonitorStatusRow = Omit<
  MonitorStatusRow,
  "createdAt" | "updatedAt"
> & {
  createdAt: Date | null;
  updatedAt: Date | null;
};

let monitorStmtCache: {
  db: Database;
  stmt: PreparedStatement<MonitorRow>;
} | null = null;

const MONITOR_QUERY_SQL = `
  SELECT
    id,
    job_type         AS jobType,
    periodicity,
    status,
    active,
    regions,
    url,
    name,
    external_name    AS externalName,
    description,
    headers,
    body,
    method,
    workspace_id     AS workspaceId,
    timeout,
    degraded_after   AS degradedAfter,
    assertions,
    otel_endpoint    AS otelEndpoint,
    otel_headers     AS otelHeaders,
    public,
    retry,
    follow_redirects AS followRedirects,
    created_at       AS createdAt,
    updated_at       AS updatedAt,
    deleted_at       AS deletedAt
  FROM monitor
  WHERE periodicity = ?
    AND active = 1
    AND id NOT IN (
      SELECT pc.monitor_id
      FROM maintenance_to_page_component mtpc
      INNER JOIN maintenance m      ON mtpc.maintenance_id = m.id
      INNER JOIN page_component pc  ON mtpc.page_component_id = pc.id
      WHERE m."from" <= ?
        AND m."to"   >= ?
        AND pc.monitor_id IS NOT NULL
    )
`;

async function getMonitorStmt(
  db: Database,
): Promise<PreparedStatement<MonitorRow>> {
  if (monitorStmtCache?.db === db) return monitorStmtCache.stmt;
  const prepared = (await db.prepare(
    MONITOR_QUERY_SQL,
  )) as PreparedStatement<MonitorRow>;
  monitorStmtCache = { db, stmt: prepared };
  return prepared;
}

function toDate(value: number | null): Date | null {
  return value == null ? null : new Date(value * 1000);
}

function toBool(value: number | null): boolean | null {
  return value == null ? null : value !== 0;
}

function hydrateMonitorRow(r: MonitorRow): HydratedMonitorRow {
  return {
    ...r,
    active: r.active !== 0,
    public: toBool(r.public),
    followRedirects: toBool(r.followRedirects),
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
    deletedAt: toDate(r.deletedAt),
  };
}

function hydrateMonitorStatusRow(
  r: MonitorStatusRow,
): HydratedMonitorStatusRow {
  return {
    ...r,
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  };
}

export async function sendCheckerTasks(
  periodicity: z.infer<typeof monitorPeriodicitySchema>,
): Promise<{ success: number; failed: number }> {
  const parent = client.queuePath(
    env().GCP_PROJECT_ID,
    env().GCP_LOCATION,
    periodicity,
  );

  const timestamp = Date.now();

  const db = await getDb();

  const pullStart = Date.now();
  try {
    const changed = await db.pull();
    logger.info("Pulled replica", {
      periodicity,
      changed,
      duration_ms: Date.now() - pullStart,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Replica pull failed; continuing against local state", {
      periodicity,
      error_message: message,
    });
    void reportBackgroundError(
      `Replica pull failed (${periodicity}): ${message}`,
    );
  }

  // maintenance.from/to use SQLite integer timestamp mode (unix seconds).
  const nowSec = Math.floor(Date.now() / 1000);

  const monitorStmt = await getMonitorStmt(db);
  const rawMonitors = await monitorStmt.all(periodicity, nowSec, nowSec);
  const hydratedMonitors = rawMonitors.map(hydrateMonitorRow);

  logger.info("Starting cron job", {
    periodicity,
    monitor_count: hydratedMonitors.length,
  });

  const monitors = z.array(selectMonitorSchema).safeParse(hydratedMonitors);
  const taskInputs: TaskInput[] = [];
  if (!monitors.success) {
    logger.error(`Error while fetching the monitors ${monitors.error}`);
    throw new Error("Error while fetching the monitors");
  }

  if (monitors.data.length === 0) {
    logger.info("No monitors to check", { periodicity });
    return { success: 0, failed: 0 };
  }

  // Batch fetch all monitor statuses in a single query (N+1 fix).
  // SQLite caps prepared-statement params at 999; openstatus is well under that today.
  const monitorIds = monitors.data.map((m) => m.id);
  const placeholders = monitorIds.map(() => "?").join(", ");
  const rawStatuses = (await db.all(
    `
    SELECT
      monitor_id AS monitorId,
      region,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM monitor_status
    WHERE monitor_id IN (${placeholders})
    `,
    ...monitorIds,
  )) as MonitorStatusRow[];

  const statusMap = new Map<
    number,
    z.infer<typeof selectMonitorStatusSchema>[]
  >();
  for (const raw of rawStatuses) {
    const parsed = selectMonitorStatusSchema.safeParse(
      hydrateMonitorStatusRow(raw),
    );
    if (!parsed.success) {
      logger.error("Failed to parse monitor status row", {
        monitor_id: raw.monitorId,
        error_message: parsed.error.message,
      });
      continue;
    }
    const list = statusMap.get(raw.monitorId) ?? [];
    list.push(parsed.data);
    statusMap.set(raw.monitorId, list);
  }

  for (const row of monitors.data) {
    const monitorStatuses = statusMap.get(row.id) ?? [];

    for (const region of row.regions) {
      const status =
        monitorStatuses.find((m) => region === m.region)?.status || "active";

      const r = regionDict[region as keyof typeof regionDict];

      if (!r) {
        logger.error(`Invalid region ${region}`);
        continue;
      }
      if (r.deprecated) {
        // Let's uncomment this when we are ready to remove deprecated regions
        // We should not use deprecated regions anymore
        logger.error(`Deprecated region ${region}`);
        continue;
      }
      taskInputs.push({ row, timestamp, status, region });
      if (periodicity === "30s") {
        const scheduledAt = timestamp + 30 * 1000;
        taskInputs.push({
          row,
          timestamp: scheduledAt,
          status,
          region,
        });
      }
    }
  }

  const results = await Effect.runPromise(
    Effect.forEach(
      taskInputs,
      (input) =>
        Effect.tryPromise({
          try: () => createCronTask(input, parent),
          catch: (err) => {
            if (err instanceof Error && "code" in err && err.code === 6) {
              return "ALREADY_EXISTS" as const;
            }
            return new Error(
              `Failed creating task for monitor ${input.row.id} in region ${input.region}`,
            );
          },
        }).pipe(
          Effect.catchIf(
            (err): err is "ALREADY_EXISTS" => err === "ALREADY_EXISTS",
            () => Effect.void,
          ),
          Effect.retry({
            times: 3,
            schedule: Schedule.exponential("1000 millis"),
          }),
          Effect.either,
        ),
      { concurrency: 100 },
    ),
  );

  for (const result of results) {
    if (Either.isLeft(result)) {
      logger.error("Task creation failed after retries", {
        error_message: result.left.message,
      });
    }
  }

  const success = results.filter(Either.isRight).length;
  const failed = results.filter(Either.isLeft).length;

  logger.info("Completed cron job", {
    periodicity,
    total_tasks: taskInputs.length,
    success_count: success,
    failed_count: failed,
    duration_ms: Date.now() - timestamp,
  });
  if (failed > 0) {
    logger.error("Cron job had failures", {
      periodicity,
      failed_count: failed,
      success_count: success,
    });
  }

  return { success, failed };
}
// timestamp needs to be in ms
const createCronTask = async (
  { row, timestamp, status, region }: TaskInput,
  parent: string,
) => {
  let payload:
    | z.infer<typeof httpPayloadSchema>
    | z.infer<typeof tpcPayloadSchema>
    | z.infer<typeof DNSPayloadSchema>
    | null = null;

  //
  if (row.jobType === "http") {
    payload = {
      workspaceId: String(row.workspaceId),
      monitorId: String(row.id),
      url: row.url,
      method: row.method || "GET",
      cronTimestamp: timestamp,
      body: row.body,
      headers: row.headers,
      status: status,
      assertions: row.assertions ? JSON.parse(row.assertions) : null,
      degradedAfter: row.degradedAfter,
      timeout: row.timeout,
      trigger: "cron",
      otelConfig: row.otelEndpoint
        ? {
            endpoint: row.otelEndpoint,
            headers: transformHeaders(row.otelHeaders),
          }
        : undefined,
      retry: row.retry || 3,
      followRedirects:
        row.followRedirects === null ? true : row.followRedirects,
    };
  }
  if (row.jobType === "tcp") {
    payload = {
      workspaceId: String(row.workspaceId),
      monitorId: String(row.id),
      uri: row.url,
      status: status,
      assertions: row.assertions ? JSON.parse(row.assertions) : null,
      cronTimestamp: timestamp,
      degradedAfter: row.degradedAfter,
      timeout: row.timeout,
      trigger: "cron",
      retry: row.retry || 3,
      otelConfig: row.otelEndpoint
        ? {
            endpoint: row.otelEndpoint,
            headers: transformHeaders(row.otelHeaders),
          }
        : undefined,
    };
  }
  if (row.jobType === "dns") {
    payload = {
      workspaceId: String(row.workspaceId),
      monitorId: String(row.id),
      uri: row.url,
      cronTimestamp: timestamp,
      status: status,
      assertions: row.assertions ? JSON.parse(row.assertions) : null,
      degradedAfter: row.degradedAfter,
      timeout: row.timeout,
      trigger: "cron",
      otelConfig: row.otelEndpoint
        ? {
            endpoint: row.otelEndpoint,
            headers: transformHeaders(row.otelHeaders),
          }
        : undefined,
      retry: row.retry || 3,
    };
  }

  if (!payload) {
    throw new Error("Invalid jobType");
  }
  const regionInfo = regionDict[region];
  let regionHeader = {};
  if (regionInfo.provider === "fly") {
    regionHeader = { "fly-prefer-region": region };
  }
  if (regionInfo.provider === "koyeb") {
    regionHeader = { "X-KOYEB-REGION-OVERRIDE": region.replace("koyeb_", "") };
  }
  if (regionInfo.provider === "railway") {
    regionHeader = { "railway-region": region.replace("railway_", "") };
  }
  const taskName = `${parent}/tasks/monitor-${row.id}-${region}-${timestamp}`;
  const newTask: google.cloud.tasks.v2beta3.ITask = {
    name: taskName,
    httpRequest: {
      headers: {
        "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
        ...regionHeader,
        Authorization: `Basic ${env().CRON_SECRET}`,
      },
      httpMethod: "POST",
      url: generateUrl({ row, region }),
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: {
      seconds: timestamp / 1000,
    },
  };

  const request = { parent: parent, task: newTask };
  return client.createTask(request);
};

function generateUrl({
  row,
  region,
}: {
  row: z.infer<typeof selectMonitorSchema>;
  region: Region;
}) {
  const regionInfo = regionDict[region];

  switch (regionInfo.provider) {
    case "fly":
      return `https://openstatus-checker.fly.dev/checker/${row.jobType}?monitor_id=${row.id}`;
    case "koyeb":
      return `https://openstatus-checker.koyeb.app/checker/${row.jobType}?monitor_id=${row.id}`;
    case "railway":
      return `https://railway-proxy-production-9cb1.up.railway.app/checker/${row.jobType}?monitor_id=${row.id}`;

    default:
      throw new Error("Invalid jobType");
  }
}
