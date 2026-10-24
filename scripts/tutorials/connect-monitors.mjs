// How to show monitors on a status page: Components tab → add monitors → save.
// Starts on Settings: the Status Reports tab shows the page badge, which
// cannot load for the seeded page's made-up custom domain.

const PAGE_ID = 2;

export default async function ({
  page,
  sql,
  warm,
  goto,
  start,
  click,
  wait,
  settle,
}) {
  await sql([
    { q: "delete from page_component where page_id = ?", params: [PAGE_ID] },
  ]);

  await warm([`/status-pages/${PAGE_ID}/components`]);

  await goto(`/status-pages/${PAGE_ID}/edit`);
  await start();
  await wait(1000);

  await click(
    page
      .getByRole("link", { name: "Components", exact: true })
      .filter({ visible: true })
      .first(),
  );
  await page.waitForURL(`**/status-pages/${PAGE_ID}/components`);
  await settle();
  await wait(800);

  await click(page.getByRole("button", { name: "Add Component", exact: true }));
  await click(page.getByRole("menuitem", { name: "Add Monitor Component" }));
  for (const monitor of ["API", "Website", "Search"]) {
    await click(page.getByRole("option", { name: monitor, exact: true }));
    await wait(300);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await wait(800);

  await click(page.getByRole("button", { name: "Submit" }).first());
  await wait(2500);
}
