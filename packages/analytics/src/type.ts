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
    }
  | {
      event: "Page Created";
      slug: string;
    }
  | { event: "User Upgraded"; email: string }
  | { event: "User Signed In" }
  | { event: "User Vercel Beta" };
