// Moves for the dashboard's recurring widgets, built on the recorder's own
// click/type/wait so every one is logged for the Remotion cursor and camera.
export function createUi({ page, click, type, wait, expect }) {
  const button = (target) =>
    typeof target === "string"
      ? page.getByRole("button", { name: target, exact: true })
      : target;

  // A side sheet: open it, fill it, submit, and wait for the app to confirm.
  async function sheet(trigger, name) {
    await click(button(trigger));
    const dialog = page.getByRole("dialog", name ? { name } : undefined);
    await dialog.waitFor();
    await wait(400);
    return {
      locator: dialog,
      field: (label) => dialog.getByRole("textbox", { name: label }),
      fill: (label, text) =>
        type(dialog.getByRole("textbox", { name: label }), text),
      check: (names) => check(dialog, names),
      async submit(confirmation = "Saved") {
        await click(dialog.getByRole("button", { name: "Submit" }));
        await dialog.waitFor({ state: "hidden" });
        if (confirmation) await expect(confirmation);
      },
    };
  }

  async function check(scope, names) {
    for (const name of names)
      await click(scope.getByRole("checkbox", { name, exact: true }));
  }

  // The date-time popover: walk the grid to the month, pick the day, then set
  // the native <input type="time">, which typing cannot overwrite. The fill
  // is instant, so it is not logged as typing; the click before it is.
  async function pickDateTime(trigger, date, time) {
    await click(button(trigger));
    const picker = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("grid") });
    const month = date.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
    for (let i = 0; i < 24; i++) {
      if (await picker.getByRole("grid", { name: month }).count()) break;
      await click(picker.getByRole("button", { name: "Go to next month" }));
    }
    await click(
      picker.getByRole("gridcell", {
        name: String(date.getDate()),
        exact: true,
      }),
    );
    const timeBox = picker.getByRole("textbox", { name: "Time" });
    await click(timeBox);
    await timeBox.fill(time);
    await wait(400);
    await page.keyboard.press("Escape");
    await wait(300);
  }

  // A menu that stays open while options are toggled, like "Add Component".
  async function multiSelect(trigger, submenu, options) {
    await click(button(trigger));
    if (submenu) await click(page.getByRole("menuitem", { name: submenu }));
    for (const option of options)
      await click(page.getByRole("option", { name: option, exact: true }));
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await wait(400);
  }

  async function select(combobox, option) {
    await click(page.getByRole("combobox", { name: combobox }));
    await click(page.getByRole("option", { name: option }));
  }

  // Tab links also appear in banners and hidden mobile nav; take the shown one.
  const tab = (name) =>
    click(
      page
        .getByRole("link", { name, exact: true })
        .filter({ visible: true })
        .first(),
    );

  return { sheet, check, pickDateTime, multiSelect, select, tab };
}
