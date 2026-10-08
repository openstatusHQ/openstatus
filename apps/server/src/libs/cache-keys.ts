// The Redis keyspace is flat and shared across apps — never key on bare
// user input, or one route can read or overwrite another's entries.
export const cacheKeys = {
  pageStatus: (slug: string) => `status:page:${slug}`,
  monitorDailyStats: (id: string | number) => `stats:monitor:${id}:daily`,
};
