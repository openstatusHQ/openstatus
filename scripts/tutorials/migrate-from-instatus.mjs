// Moving from Instatus: the Import card, up to the preview.
import { migrate } from "./lib/migrate.mjs";

export const meta = {
  order: 9,
  label: "Migrate",
  thumbEyebrow: "Migrate · Instatus",
  title: "Switch from Instatus",
  subtitle:
    "Bring your components, incidents, maintenances and subscribers with one API key.",
  outroTitle: "Your status page, moved.",
  outroSubtitle: "Preview the import, then run it.",
  // Narrow enough for every provider tile of the Import card to show.
  viewport: { width: 1120, height: 900 },
};

export default (rec) =>
  migrate(rec, {
    provider: "Instatus",
    idLabel: "Page ID (optional)",
    id: "clx1abc2def3",
  });
