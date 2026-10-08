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
    userId: userId ? `usr_${userId}` : undefined,
    workspaceId: String(ctx.workspace.id),
    workspaceName: ctx.workspace.name || ctx.workspace.slug,
    plan: ctx.workspace.plan,
    source: "slack",
  })
    .then((analytics) => analytics.track({ ...props, ...EVENTS[kind] }))
    .catch(() => undefined);
}
