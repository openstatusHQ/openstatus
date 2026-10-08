import { plural } from "./format";
import type { KeyValueRow } from "./key-value";

export interface PlanLoss {
  monitorsDeactivated: number;
  pagesDeleted: string[];
  keptPageTitle?: string | null;
  notificationsDeleted: number;
  invitationsDeleted: number;
  membersRemoved: number;
  customDomains: string[];
  sso: boolean;
}

/** Rows for what a downgrade removed (`past`) or will remove. Zero rows are dropped. */
export function planLossRows(loss: PlanLoss, past: boolean): KeyValueRow[] {
  const rows: KeyValueRow[] = [];
  if (loss.pagesDeleted.length > 0) {
    rows.push({
      label: past ? "Status pages deleted" : "Status pages that get deleted",
      value: loss.pagesDeleted.join(", "),
      tone: "danger",
    });
  }
  if (loss.keptPageTitle) {
    rows.push({ label: "Status page kept", value: loss.keptPageTitle });
  }
  if (loss.monitorsDeactivated > 0) {
    rows.push({
      label: past ? "Monitors paused" : "Monitors that get paused",
      value: `${plural(loss.monitorsDeactivated, "monitor")}, oldest stays active`,
    });
  }
  if (loss.membersRemoved > 0) {
    rows.push({
      label: past ? "Members removed" : "Members that lose access",
      value: plural(loss.membersRemoved, "member"),
    });
  }
  if (loss.invitationsDeleted > 0) {
    rows.push({
      label: "Pending invitations",
      value: `${loss.invitationsDeleted} ${past ? "deleted" : "get deleted"}`,
    });
  }
  if (loss.notificationsDeleted > 0) {
    rows.push({
      label: "Notification channels",
      value: `${loss.notificationsDeleted} ${past ? "removed" : "get removed"}, one stays`,
    });
  }
  if (loss.customDomains.length > 0) {
    rows.push({
      label: `Custom domain${loss.customDomains.length === 1 ? "" : "s"}${
        past ? " released" : ""
      }`,
      value: loss.customDomains.join(", "),
      mono: true,
    });
  }
  if (loss.sso) {
    rows.push({
      label: "SAML SSO",
      value: past
        ? "Off, IdP configuration kept"
        : "Turns off, IdP configuration kept",
    });
  }
  return rows;
}
