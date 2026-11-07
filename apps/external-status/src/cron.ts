import { Hono } from "hono";

import { env } from "./env";
import { handleExternalIncidentsPruneCron } from "./external-incidents-prune";
import { handleExternalStatusCron } from "./external-status";

const app = new Hono({ strict: false });

app.use("*", async (c, next) => {
  if (c.req.header("authorization") !== env().CRON_SECRET) {
    return c.text("Unauthorized", 401);
  }

  return next();
});

app.get("/external-status", async (c) => {
  return handleExternalStatusCron(c);
});

app.get("/external-incidents-prune", async (c) => {
  return handleExternalIncidentsPruneCron(c);
});

export { app as cronRouter };
