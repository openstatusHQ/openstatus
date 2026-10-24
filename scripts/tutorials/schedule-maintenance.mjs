// How to schedule a maintenance: pick a future window, affected components,
// and a message for subscribers.

const PAGE_ID = 1;
const TITLE = "Database upgrade";

// A few days out, on a day number that appears once in the month grid
// (the 8th–21st never repeat as leading or trailing days of another month).
function targetDay() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDate() < 8 || d.getDate() > 21) d.setDate(d.getDate() + 1);
  return d;
}

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
  const ids = `select id from maintenance where title = '${TITLE}'`;
  await sql([
    `delete from maintenance_update where maintenance_id in (${ids})`,
    `delete from maintenance_to_page_component where maintenance_id in (${ids})`,
    `delete from maintenance where id in (${ids})`,
  ]);

  await warm([`/status-pages/${PAGE_ID}/maintenances`]);

  await goto(`/status-pages/${PAGE_ID}/maintenances`);
  await start();
  await wait(1000);

  await click(page.getByRole("button", { name: "Create Maintenance" }));
  const sheet = page.getByRole("dialog", { name: "Maintenance" });
  await sheet.waitFor();
  await wait(500);
  await type(sheet.getByRole("textbox", { name: "Title" }), TITLE);

  const day = targetDay();
  const monthsAhead = day.getMonth() - new Date().getMonth();
  for (const [field, time] of [
    ["Start Date", "22:00"],
    ["End Date", "23:30"],
  ]) {
    await click(sheet.getByRole("button", { name: field }));
    const picker = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("grid") });
    // End Date opens on the start's month already.
    if (field === "Start Date")
      for (let i = 0; i < (monthsAhead + 12) % 12; i++)
        await click(picker.getByRole("button", { name: "Go to next month" }));
    await click(
      picker.getByRole("gridcell", {
        name: String(day.getDate()),
        exact: true,
      }),
    );
    const timeBox = picker.getByRole("textbox", { name: "Time" });
    // Native <input type="time">: typing does not replace its segments.
    await click(timeBox);
    await timeBox.fill(time);
    await wait(400);
    await page.keyboard.press("Escape");
    await wait(500);
  }

  await type(
    sheet.getByRole("textbox", { name: "Message" }),
    "We are upgrading our database. The API may be read-only for a few minutes.",
  );
  await click(sheet.getByRole("checkbox", { name: "API" }));
  await wait(400);
  await click(sheet.getByRole("button", { name: "Submit" }));
  await sheet.waitFor({ state: "hidden" });
  await wait(2500);
}
