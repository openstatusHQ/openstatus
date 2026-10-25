// How to get alerted: add an email notifier and attach it to monitors.
import { cleanup, monitors } from "./lib/fixtures.mjs";

export const meta = {
  order: 6,
  label: "Alert",
  title: "Get alerted",
  subtitle: "Hear about downtime before your customers do.",
  outroTitle: "You'll be the first to know.",
  outroSubtitle: "Next: add Slack, PagerDuty or a webhook as well.",
};

const NAME = "Platform team";

export default async function ({ page, sql, warm, start, step, sheet }) {
  await sql(cleanup.notification({ name: NAME }));
  await warm(["/notifications"]);

  await start("/notifications", "Pick a channel in Notifications");
  const notifier = await sheet(
    page.getByText("Send notifications to Email"),
    "Notifier",
  );

  step("Where should alerts go?");
  await notifier.fill("Name", NAME);
  await notifier.fill("Email", "platform@acme.com");
  step("Choose the monitors to watch");
  await notifier.check([monitors.api, monitors.website, monitors.search]);

  step("Save");
  await notifier.submit();
}
