export type AnalyticsEvents =
  | {
      event: "User Created";
      properties: {
        email: string;
      };
    }
  | {
      event: "Monitor Created";
      properties: { url: string; periodicity: string };
    }
  | {
      event: "Page Created";
      properties: {
        slug: string;
      };
    };
