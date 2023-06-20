import { ImageResponse } from "next/server";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const TITLE = "Open Status";
const DESCRIPTION = "An Open Source Alternative for your next Status Page";

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
      <div tw="relative flex flex-col bg-white items-center justify-center w-full h-full">
        <div
          tw="flex w-full h-full absolute inset-0"
          // not every css variable is supported
          style={{
            backgroundImage: "radial-gradient(#94a3b8 10%, transparent 10%)",
            backgroundPosition: "0px 0px, 6px 6px",
            backgroundSize: "12px 12px",
            filter: "blur(1px)", // to be discussed... couldn't put it inside the content container
          }}
        ></div>
        <div tw="max-w-2xl relative flex flex-col items-center rounded-lg border border-slate-200 p-6 overflow-hidden bg-white bg-opacity-80">
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
