// The migrate-from-* tutorials: open the Import card of a status page, pick
// the provider and paste a key. They stop before Preview Import, which calls
// the provider's API and needs a real key.
import { pages } from "./fixtures.mjs";

export async function migrate(
  { page, warm, start, step, click, type, moveTo, settle, thumbnail },
  { provider, idLabel, id },
) {
  const path = `/status-pages/${pages.main}/components`;
  await warm([path]);
  await start(path, "Open the status page's components");
  const card = page
    .locator("form")
    .filter({ hasText: "Import components, incidents, and subscribers" });

  step(`Pick ${provider}`);
  // The provider's name also shows as its icon's title; take the label.
  await click(card.locator("label").getByText(provider, { exact: true }));
  step("Paste an API key from your account");
  await type(card.getByLabel("API Key"), "tutorial-example-api-key");
  await type(card.getByLabel(idLabel), id);
  step("Preview what comes over, then import");
  await moveTo(card.getByRole("button", { name: "Preview Import" }));
  await settle();
  await thumbnail(card);
}
