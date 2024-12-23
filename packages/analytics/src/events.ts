export type EventProps = {
  name: string;
  channel: string;
};

export const Events = {
  CreateUser: {
    name: "user_created",
    channel: "registration",
  },
  SkipOnboarding: {
    name: "onboarding_skipped",
    channel: "onboarding",
  },
  CompleteOnboarding: {
    name: "onboarding_completed",
    channel: "onboarding",
  },
  SignInUser: {
    name: "user_signed_in",
    channel: "login",
  },
  SignOutUser: {
    name: "user_signed_out",
    channel: "login",
  },
  CreateMonitor: {
    name: "monitor_created",
    channel: "monitor",
  },
  UpdateMonitor: {
    name: "monitor_updated",
    channel: "monitor",
  },
  DeleteMonitor: {
    name: "monitor_deleted",
    channel: "monitor",
  },
  CloneMonitor: {
    name: "monitor_cloned",
    channel: "monitor",
  },
  TestMonitor: {
    name: "monitor_tested",
    channel: "monitor",
  },
  CreatePage: {
    name: "page_created",
    channel: "page",
  },
  UpdatePage: {
    name: "page_updated",
    channel: "page",
  },
  DeletePage: {
    name: "page_deleted",
    channel: "page",
  },
  SubscribePage: {
    name: "user_subscribed",
    channel: "page",
  },
  CreateReport: {
    name: "report_created",
    channel: "report",
  },
  UpdateReport: {
    name: "report_updated",
    channel: "report",
  },
  DeleteReport: {
    name: "report_deleted",
    channel: "report",
  },
  CreateMaintenance: {
    name: "maintenance_created",
    channel: "maintenance",
  },
  UpdateMaintenance: {
    name: "maintenance_updated",
    channel: "maintenance",
  },
  DeleteMaintenance: {
    name: "maintenance_deleted",
    channel: "maintenance",
  },
  CreateNotification: {
    name: "notification_created",
    channel: "notification",
  },
  UpdateNotification: {
    name: "notification_updated",
    channel: "notification",
  },
  DeleteNotification: {
    name: "notification_deleted",
    channel: "notification",
  },
  AcknowledgeIncident: {
    name: "incident_acknowledged",
    channel: "incident",
  },
  ResolveIncident: {
    name: "incident_resolved",
    channel: "incident",
  },
  UpdateIncident: {
    name: "incident_updated",
    channel: "incident",
  },
  DeleteIncident: {
    name: "incident_deleted",
    channel: "incident",
  },
  InviteUser: {
    name: "user_invited",
    channel: "team",
  },
  DeleteInvite: {
    name: "invitation_deleted",
    channel: "team",
  },
  AcceptInvite: {
    name: "invitation_accepted",
    channel: "team",
  },
  RemoveUser: {
    name: "user_removed",
    channel: "team",
  },
  CreateAPI: {
    name: "api_key_created",
    channel: "api_key",
  },
  RevokeAPI: {
    name: "api_key_revoked",
    channel: "api_key",
  },
  UpgradeWorkspace: {
    name: "workspace_updated",
    channel: "billing",
  },
  StripePortal: {
    name: "stripe_portal",
    channel: "billing",
  },
  DowngradeWorkspace: {
    name: "workspace_downgraded",
    channel: "billing",
  },
} as const satisfies Record<string, EventProps>;
