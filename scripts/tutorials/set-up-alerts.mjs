// How to get alerted: add an email notifier and attach it to monitors.

const NAME = "Platform team";

export default async function ({
  page,
  sql,
  warm,
  goto,
  start,
  click,
  type,
  wait,
}) {
  const ids = `select id from notification where name = '${NAME}'`;
  await sql([
    `delete from notifications_to_monitors where notification_id in (${ids})`,
    `delete from notification where id in (${ids})`,
  ]);

  await warm(["/notifications"]);

  await goto("/notifications");
  await start();
  await wait(1200);

  await click(page.getByText("Send notifications to Email"));
  const sheet = page.getByRole("dialog", { name: "Notifier" });
  await sheet.waitFor();
  await wait(500);

  await type(sheet.getByRole("textbox", { name: "Name" }), NAME);
  await type(
    sheet.getByRole("textbox", { name: "Email" }),
    "platform@acme.com",
  );
  await wait(400);
  for (const monitor of ["API", "Website", "Search"])
    await click(sheet.getByRole("checkbox", { name: monitor, exact: true }));
  await wait(500);

  await click(sheet.getByRole("button", { name: "Submit" }));
  await sheet.waitFor({ state: "hidden" });
  await wait(2500);
}
