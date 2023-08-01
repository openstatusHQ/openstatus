export const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

// We can't secure cron endpoint by vercel thus we should make sure they are called by the generated url
export const isAuthorizedDomain = (url: string) => {
  return url.includes(DEFAULT_URL);
};
