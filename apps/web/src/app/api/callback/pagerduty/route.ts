import { redirect } from "next/navigation";

const DASHBOARD_V2 = false;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace");

  const APP_URL = `${
    process.env.NODE_ENV === "development" // FIXME: This sucks
      ? "http://localhost:3000"
      : "https://app.openstatus.dev"
  }/notifiers?${searchParams}&channel=pagerduty`;

  const WWW_URL = `${
    process.env.NODE_ENV === "development" // FIXME: This sucks
      ? "http://localhost:3000"
      : "https://www.openstatus.dev"
  }/app/${workspace}/notifications/new/pagerduty?${searchParams}`;

  redirect(DASHBOARD_V2 ? APP_URL : WWW_URL);
}
