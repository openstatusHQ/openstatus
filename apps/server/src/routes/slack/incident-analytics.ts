import { Events, setupAnalytics } from "@openstatus/analytics";
import { type ServiceContext, tryGetActorUserId } from "@openstatus/services";

const EVENTS = {
  declare: Events.DeclareManagedIncident,
  status: Events.ChangeManagedIncidentStatus,
  note: Events.AddManagedIncidentNote,
  postmortem: Events.DraftManagedPostmortem,
  approved: Events.ApproveManagedPostmortem,
  closed: Events.CloseManagedIncident,
} as const;

/** Fire-and-forget: analytics never fails a Slack action. */
export function trackSlackIncident(
  ctx: ServiceContext,
  kind: keyof typeof EVENTS,
  props: Record<string, string> = {},
): void {
  const userId = tryGetActorUserId(ctx.actor);
  setupAnalytics({
    userId: userId ? `usr_${userId}` : `slack_${ctx.workspace.id}`,
    workspaceId: String(ctx.workspace.id),
    plan: ctx.workspace.plan,
  })
    .then((analytics) =>
      analytics.track({ ...EVENTS[kind], source: "slack", ...props }),
    )
    .catch(() => undefined);
}
