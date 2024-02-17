import { ImageResponse } from "next/og";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { getStatusByRatio, incidentStatus } from "@/lib/tracker";
import { api } from "@/trpc/server";
import { BasicLayout } from "../_components/basic-layout";
import { StatusCheck } from "../_components/status-check";
import { calSemiBold, interLight, interRegular, SIZE } from "../utils";

export const runtime = "edge";

export async function GET(req: Request) {
  const interRegularData = await interRegular;
  const interLightData = await interLight;
  const calSemiBoldData = await calSemiBold;

  const { searchParams } = new URL(req.url);

  const slug = searchParams.has("slug") ? searchParams.get("slug") : undefined;

  const page = await api.page.getPageBySlug.query({ slug: slug || "" });

  const title = page ? page.title : TITLE;
  const description = page ? "" : DESCRIPTION;

  const isStatusReport = page?.statusReports.some(
    (incident) => !["monitoring", "resolved"].includes(incident.status),
  );

  const isIncident = page?.incidents.some(
    (incident) => incident.resolvedAt === null,
  );

  const status = isStatusReport
    ? incidentStatus
    : getStatusByRatio(isIncident ? 0.5 : 1);

  return new ImageResponse(
    (
      <BasicLayout title={title} description={description} tw="py-24 px-24">
        <StatusCheck variant={status.variant} />
      </BasicLayout>
    ),
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
