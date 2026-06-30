// Test double for src/routes/slack/page-urls.ts (which hits the db), swapped in
// via --import-map so slack presenter tests get deterministic URLs.
export const getPageUrl = (_pageId: number): Promise<string | null> =>
  Promise.resolve("https://example.openstatus.dev");

export const getReportUrl = (
  _pageId: number,
  reportId: number,
): Promise<string | null> =>
  Promise.resolve(`https://example.openstatus.dev/events/report/${reportId}`);
