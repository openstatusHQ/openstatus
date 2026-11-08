// Product update: pick a status page's time zone in the dashboard, then see
// the public page show its timestamps in it.
import { pages, workspace } from "../tutorials/lib/fixtures.mjs";

export const meta = {
  format: "update",
  title: "Status page time zone",
  tagline: "One clock for every visitor.",
};

const ZONE = { search: "Tokyo", name: "Asia/Tokyo", short: "GMT+9" };

const reset = [
  {
    q: "update page set default_timezone = 'UTC' where id = ? and workspace_id = ?",
    params: [pages.main, workspace],
  },
];

export default async function ({
  page,
  sql,
  warm,
  start,
  step,
  click,
  type,
  expect,
  wait,
  cut,
}) {
  await sql(reset);
  try {
    await warm([`/status-pages/${pages.main}/edit`]);
    await start(
      `/status-pages/${pages.main}/edit#timezone`,
      "Pick your page's time zone",
    );
    const card = page.locator("#timezone");
    await click(card.getByRole("combobox"));
    await type(page.getByPlaceholder("Search time zone..."), ZONE.search);
    await click(page.getByRole("option", { name: ZONE.name }));

    step("Save it");
    await click(card.getByRole("button", { name: "Submit" }));
    await expect("Saved");
    await wait(600);
    // The public page is one narrow column: a smaller window reads larger.
    await cut("statusPage", { viewport: { width: 1080, height: 760 } });
  } finally {
    await sql(reset);
  }
}

// The public page, in the zone the dashboard just saved.
export async function statusPage({ page, start, step, look }) {
  const stamps = page.getByText(`(${ZONE.short})`);

  await start("/status", "Every visitor sees the same time");
  await look(stamps.first(), 2000);

  step("Reports and maintenance follow");
  await look(stamps.nth(1), 1800);

  step("The footer names the zone");
  await look(page.locator("footer").getByText(ZONE.name), 1400);
}
