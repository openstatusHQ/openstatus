import { ImageResponse } from "next/og";

import { Tracker } from "@openstatus/tracker";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { api } from "@/trpc/server";
import { BasicLayout } from "../_components/basic-layout";
import { StatusCheck } from "../_components/status-check";
import { SIZE, calSemiBold, interLight, interRegular } from "../utils";

export const runtime = "edge";

export async function GET(req: Request) {
  const [interRegularData, interLightData, calSemiBoldData] = await Promise.all(
    [interRegular, interLight, calSemiBold],
  );

  const { searchParams } = new URL(req.url);

  const slug = searchParams.has("slug") ? searchParams.get("slug") : undefined;
  const passwordProtected = searchParams.has("passwordProtected")
    ? searchParams.get("passwordProtected") === "true" // FIXME: can we use Boolean("true") or Boolean("false")?
    : undefined;

  const page = await api.page.getPageBySlug.query({ slug: slug || "" });
  const title = page ? page.title : TITLE;
  const description = page ? "" : DESCRIPTION;

  // REMINDER: if password protected, we keep the status 'operational' by default, hiding the actual status
  const tracker = new Tracker({
    incidents: passwordProtected ? undefined : page?.incidents,
    statusReports: passwordProtected ? undefined : page?.statusReports,
    maintenances: passwordProtected ? undefined : page?.maintenances,
  });

  return new ImageResponse(
    <BasicLayout title={title} description={description} tw="py-24 px-24">
      <StatusCheck tracker={tracker} />
    </BasicLayout>,
    {
      ...SIZE,
      fonts: [
        {
          name: "Inter",
          data: interRegularData,
          style: "normal",
          weight: 400,
        },
        {
          name: "Inter",
          data: interLightData,
          style: "normal",
          weight: 300,
        },
        {
          name: "Cal",
          data: calSemiBoldData,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
