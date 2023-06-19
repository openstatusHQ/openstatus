import { ImageResponse } from "next/server";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const TITLE = "Open Status";
const DESCRIPTION = "Open Source Alternative to ...";

const interRegular = fetch(
  new URL("../../../public/fonts/Inter-Regular.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

const calSemiBold = fetch(
  new URL("../../../public/fonts/CalSans-SemiBold.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

export async function GET(req: Request) {
  const interRegularData = await interRegular;
  const calSemiBoldData = await calSemiBold;

  const { searchParams } = new URL(req.url);
  const title = searchParams.has("title") ? searchParams.get("title") : TITLE;
  const description = searchParams.has("description")
    ? searchParams.get("description")
    : DESCRIPTION;

  return new ImageResponse(
    (
      <div tw="flex flex-col bg-white items-center justify-center w-full h-full">
        <div tw="flex flex-col items-center">
          <h1 style={{ fontFamily: "Cal" }} tw="text-6xl text-center">
            {title}
          </h1>
          <p tw="text-slate-600 text-3xl text-center">{description}</p>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: interRegularData,
          style: "normal",
          weight: 400,
        },
        {
          name: "Cal",
          data: calSemiBoldData,
          style: "normal",
          weight: 600,
        },
      ],
    }
  );
}
