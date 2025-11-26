import type { Metadata } from "next";
import StatusPlay from "./_components/status-play";

export const metadata: Metadata = {
  title: "Status Page Preview",
  description: "Display your status page with real time data.",
  openGraph: {
    title: "Status Page Preview",
    description: "Display your status page with real time data.",
    url: "https://www.openstatus.dev/play/status",
  },
};

export const revalidate = 600;

export default async function PlayPage() {
  const hasValidApiKey =
    process.env.TINY_BIRD_API_KEY &&
    process.env.TINY_BIRD_API_KEY !== "tiny-bird-api-key";

  if (!hasValidApiKey) {
    return <div>Preview requires valid API configuration</div>;
  }

  return (
    <div className="w-full">
      <StatusPlay />
    </div>
  );
}
