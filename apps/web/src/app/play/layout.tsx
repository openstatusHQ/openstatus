import * as React from "react";
import type { Metadata } from "next";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { MarketingLayout } from "@/components/layout/marketing-layout";

export const metadata: Metadata = {
  ...defaultMetadata,
  twitter: {
    ...twitterMetadata,
    images: [`/api/og?monitorId=openstatus`],
  },
  openGraph: {
    ...ogMetadata,
    images: [`/api/og?monitorId=openstatus`],
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
