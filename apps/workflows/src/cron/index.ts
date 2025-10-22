// import { getSentry } from "@hono/sentry";
import { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { env } from "../env";
import { sendCheckerTasks } from "./checker";
import { sendFollowUpEmails } from "./emails";
import {
  LaunchMonitorWorkflow,
  Step3Days,
  Step14Days,
  StepPaused,
  workflowStepSchema,
} from "./monitor";

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
  // const sentry = getSentry(c);
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: period,
    status: "in_progress",
  });
  try {
    await sendCheckerTasks(schema.data, c);
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: period,
      status: "ok",
    });
    return c.json({ success: schema.data }, 200);
  } catch (e) {
    console.error(e);
    Sentry.captureMessage(`Error in /checker/${period} cron: ${e}`, "error");
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: period,
      status: "error",
    });
    return c.text("Internal Server Error", 500);
  }
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
      // We send the first email
      await Step14Days(Number(userId), Number(initialRun));
      break;
    case "3days":
      await Step3Days(Number(userId), Number(initialRun));
      // 3 days before we send the second email
      break;
    case "paused":
      // Let's pause the monitor
      await StepPaused(Number(userId), Number(initialRun));
      break;
    default:
      throw new Error("Invalid step");
  }
  // Swith on step
  // and do the right action
  //
  return c.json({ success: true }, 200);
});

export { app as cronRouter };
