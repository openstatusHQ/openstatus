import * as React from "react";
import type { Metadata } from "next";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { MarketingLayout } from "@/components/layout/marketing-layout";

const TITLE = "OpenStatus";
const DESCRIPTION =
  "Open-Source alternative to your current monitoring service with beautiful status page";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://www.openstatus.dev"),
  twitter: {
    images: [`/api/og?monitorId=openstatus`],
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  openGraph: {
    type: "website",
    images: [`/api/og?monitorId=openstatus`],
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PlayLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <MarketingLayout>
      <BackButton href="/" />
      <Shell>
        {children}
        {modal}
      </Shell>
    </MarketingLayout>
  );
}
