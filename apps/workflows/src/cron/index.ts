import { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import * as Sentry from "@sentry/deno";
import { Effect, Schedule } from "effect";
import { Hono } from "hono";

import { env } from "../env";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";
import { sendCheckerTasks } from "./checker";
import { sendFollowUpEmails } from "./emails";
import { handleExternalIncidentsPruneCron } from "./external-incidents-prune";
import { handleExternalStatusCron } from "./external-status";
import {
  LaunchMonitorWorkflow,
  Step3Days,
  Step14Days,
  StepPaused,
  workflowStepSchema,
} from "./monitor";
import { handlePrivateLocationHealthCron } from "./private-location-health";
import { handleUptimeFreezeCron } from "./uptime-freeze";

const app = new Hono({ strict: false });

app.use("*", async (c, next) => {
  if (c.req.header("authorization") !== env().CRON_SECRET) {
    return c.text("Unauthorized", 401);
  }

  return next();
});

app.get("/checker/:period", async (c) => {
  const period = c.req.param("period");

  const schema = monitorPeriodicitySchema.safeParse(period);

  if (!schema.success) {
    return c.json({ error: schema.error.issues?.[0].message }, 400);
  }
  const periodicity = schema.data;
  const { cronCompleted, cronFailed } = runSentryCron(periodicity);

  // Background chain: must not capture `c` or anything derived from it
  // (e.g. via getSentry(c)). The handler returns 200 before this resolves, and
  // a captured per-request Sentry hub stays pinned across retries — see
  // apps/workflows/plan.md.
  void Effect.runPromise(
    Effect.tryPromise({
      try: () => sendCheckerTasks(periodicity),
      // Surface `cause` — DrizzleQueryError stringifies to "Failed query: …"
      // without the underlying libSQL reason, so callers see no hint of *why*
      // the query failed unless we flatten the cause into the message.
      catch: (e) => {
        const causeMessage =
          e instanceof Error && e.cause instanceof Error
            ? `\nCause: ${e.cause.message}`
            : "";
        return new Error(
          `Error in /checker/${periodicity} cron: ${e}${causeMessage}`,
          { cause: e },
        );
      },
    }).pipe(
      Effect.retry({
        times: 3,
        schedule: Schedule.exponential("1000 millis"),
      }),
      Effect.tap((result) =>
        Effect.sync(() => {
          if (result.failed > 0) {
            void reportBackgroundError(
              `sendCheckerTasks for ${periodicity} ended with ${result.failed} failed tasks`,
            );
          }
          void cronCompleted();
        }),
      ),
      Effect.catchAll((e) =>
        Effect.sync(() => {
          console.error(e);
          void reportBackgroundError(e.message);
          void cronFailed();
        }),
      ),
    ),
  );
  return c.json({ success: periodicity }, 200);
});

app.get("/external-status", async (c) => {
  return handleExternalStatusCron(c);
});

app.get("/external-incidents-prune", async (c) => {
  return handleExternalIncidentsPruneCron(c);
});

app.get("/uptime-freeze", async (c) => {
  return handleUptimeFreezeCron(c);
});

app.get("/private-location-health", async (c) => {
  return handlePrivateLocationHealthCron(c);
});

app.get("/emails/follow-up", async (c) => {
  try {
    await sendFollowUpEmails();
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error(e);
    return c.text("Internal Server Error", 500);
  }
});

app.get("/monitors", async (c) => {
  await LaunchMonitorWorkflow();
  return c.json({ success: true }, 200);
});

app.get("/monitors/:step", async (c) => {
  const step = c.req.param("step");
  const schema = workflowStepSchema.safeParse(step);

  const userId = c.req.query("userId");
  const initialRun = c.req.query("initialRun");
  if (!schema.success) {
    return c.json({ error: schema.error.issues?.[0].message }, 400);
  }

  if (!userId) {
    Sentry.captureMessage("userId is missing in /monitors/:step cron", "error");
    return c.json({ error: "userId is required" }, 400);
  }
  if (!initialRun) {
    Sentry.captureMessage(
      "initalRun is missing in /monitors/:step cron",
      "error",
    );
    return c.json({ error: "initialRun is required" }, 400);
  }

  switch (schema.data) {
    case "14days":
      await Step14Days(Number(userId), Number(initialRun));
      break;
    case "3days":
      await Step3Days(Number(userId), Number(initialRun));
      break;
    case "paused":
      await StepPaused(Number(userId), Number(initialRun));
      break;
    default:
      throw new Error("Invalid step");
  }

  return c.json({ success: true }, 200);
});

export { app as cronRouter };
