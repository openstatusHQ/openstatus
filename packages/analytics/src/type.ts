export type AnalyticsEvents =
  | {
      event: "User Created";
      userId: string;
      email: string;
    }
  | {
      event: "Monitor Created";
      url: string;
      periodicity: string;
      api?: boolean;
      workspaceId?: string;
    }
  | {
      event: "Page Created";
      slug: string;
      api?: boolean;
    }
  | { event: "User Upgraded"; email: string }
  | { event: "User Signed In" }
  | { event: "User Vercel Beta" }
  | { event: "Notification Created"; provider: string }
  | { event: "Subscribe to Status Page"; slug: string };
