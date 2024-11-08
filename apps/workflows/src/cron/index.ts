import { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import { Hono } from "hono";
import { env } from "../env";
import { sendCheckerTasks } from "./checker";
import { sendFollowUpEmails } from "./emails";

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

  try {
    await sendCheckerTasks(schema.data);

    return c.json({ success: schema.data }, 200);
  } catch (e) {
    console.error(e);
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

export { app as cronRouter };
