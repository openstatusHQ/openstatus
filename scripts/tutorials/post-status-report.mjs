// How to post a status report: create it as investigating, then publish an
// identified and a resolved update from the report page.

const PAGE_ID = 1;
const TITLE = "Checkout errors for EU customers";

export default async function ({
  page,
  sql,
  warm,
  goto,
  start,
  step,
  click,
  type,
  wait,
  settle,
  expect,
}) {
  const ids = `select id from status_report where title = '${TITLE}' and page_id = ${PAGE_ID}`;
  await sql([
    `delete from status_report_update_to_page_component where status_report_update_id in (select id from status_report_update where status_report_id in (${ids}))`,
    `delete from status_report_update where status_report_id in (${ids})`,
    `delete from status_report_to_page_component where status_report_id in (${ids})`,
    `delete from status_report where id in (${ids})`,
  ]);

  await warm([
    `/status-pages/${PAGE_ID}/status-reports`,
    `/status-pages/${PAGE_ID}/status-reports/1`,
  ]);

  await goto(`/status-pages/${PAGE_ID}/status-reports`);
  await start();
  step("Something is wrong: open a report");
  await wait(1000);

  await click(page.getByRole("button", { name: "Create Status Report" }));
  const sheet = page.getByRole("dialog");
  await sheet.waitFor();
  await wait(500);
  step("Say what customers see");
  await type(sheet.getByRole("textbox", { name: "Title" }), TITLE);
  await type(
    sheet.getByRole("textbox", { name: "Message" }),
    "EU payments are failing at checkout. Investigating.",
  );
  step("Mark the affected component");
  await click(sheet.getByRole("checkbox", { name: "API" }));
  await wait(400);
  await click(sheet.getByRole("button", { name: "Submit" }));
  await sheet.waitFor({ state: "hidden" });
  await wait(1200);

  await click(page.getByRole("link", { name: TITLE }));
  await page.waitForURL(/\/status-reports\/\d+$/);
  await settle();
  await wait(1000);

  step("Post updates as you learn more");
  const composer = page.getByRole("textbox", { name: /What changed/ });
  const publish = page.getByRole("button", { name: "Publish update" });

  await type(
    composer,
    "Cause found: an expired certificate on the EU gateway.",
  );
  await click(publish);
  await wait(2000);

  step("Resolve it when it is fixed");
  await click(page.getByRole("combobox", { name: "Status" }));
  await click(page.getByRole("option", { name: /resolved/i }));
  await type(composer, "Certificate renewed, payments work again.");
  await click(publish);
  await expect("Update published");
  await wait(2000);
}
