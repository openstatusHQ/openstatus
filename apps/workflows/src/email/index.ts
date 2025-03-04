import { EmailClient } from "@openstatus/emails";
import { StatusReportSchema } from "@openstatus/emails/emails/status-report";
import { TeamInvitationSchema } from "@openstatus/emails/emails/team-invitation";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../env";

const schema = z.discriminatedUnion("template", [
  z.object({
    template: z.literal("status-report"),
    data: StatusReportSchema.extend({
      to: z.array(z.string()),
    }),
  }),
  z.object({
    template: z.literal("team-invitation"),
    data: TeamInvitationSchema.extend({
      to: z.string(),
    }),
  }),
]);

const emailClient = new EmailClient({ apiKey: env().RESEND_API_KEY });

const app = new Hono({ strict: false });

app.use("*", async (c, next) => {
  if (c.req.header("authorization") !== env().ADMIN_SECRET) {
    return c.text("Unauthorized", 401);
  }

  return next();
});

app.post("/send/:template", async (c) => {
  const template = c.req.param("template");
  const body = await c.req.json();

  const validation = schema.safeParse({ template, data: body });

  if (!validation.success) {
    return c.json({ error: validation.error.issues?.[0].message }, 400);
  }

  if (validation.data.template === "status-report") {
    await emailClient.sendStatusReportUpdate(validation.data.data);
  } else if (validation.data.template === "team-invitation") {
    await emailClient.sendTeamInvitation(validation.data.data);
  }

  try {
    return c.json({ success: validation.data }, 200);
  } catch (e) {
    console.error(e);
    return c.text("Internal Server Error", 500);
  }
});
