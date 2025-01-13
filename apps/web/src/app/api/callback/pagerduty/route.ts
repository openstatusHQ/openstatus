import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace");
  const url = `${
    process.env.NODE_ENV === "development" // FIXME: This sucks
      ? "http://localhost:3000"
      : "https://www.openstatus.dev"
  }/app/${workspace}/notifications/new/pagerduty?${searchParams}`;
  redirect(url);
}
