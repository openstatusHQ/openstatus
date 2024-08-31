import type { Metadata } from "next";

import { BackButton } from "@/components/layout/back-button";
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
  return (
    <div className="w-full">
      <StatusPlay />
    </div>
  );
}
