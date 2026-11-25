// Moving from Better Stack: the Import card, up to the preview.
import { migrate } from "./lib/migrate.mjs";

export const meta = {
  order: 8,
  label: "Migrate",
  thumbEyebrow: "Migrate · Better Stack",
  title: "Switch from Better Stack",
  subtitle:
    "Bring your monitors, components, incidents and maintenances with one API key.",
  outroTitle: "Your status page, moved.",
  outroSubtitle: "Preview the import, then run it.",
  // Narrow enough for every provider tile of the Import card to show.
  viewport: { width: 1120, height: 900 },
};

export default (rec) =>
  migrate(rec, {
    provider: "Better Stack",
    idLabel: "Status Page ID (optional)",
    id: "123456789",
  });
