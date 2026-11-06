// Moving from Atlassian Statuspage: the Import card, up to the preview.
import { migrate } from "./lib/migrate.mjs";

export const meta = {
  order: 7,
  label: "Migrate",
  thumbEyebrow: "Migrate · Atlassian",
  title: "Switch from Atlassian Statuspage",
  subtitle:
    "Bring your components, incidents, maintenances and subscribers with one API key.",
  outroTitle: "Your status page, moved.",
  outroSubtitle: "Preview the import, then run it.",
  // Narrow enough for every provider tile of the Import card to show.
  viewport: { width: 1120, height: 900 },
};

export default (rec) =>
  migrate(rec, {
    provider: "Atlassian Statuspage",
    idLabel: "Page ID (optional)",
    id: "abc123def456",
  });
