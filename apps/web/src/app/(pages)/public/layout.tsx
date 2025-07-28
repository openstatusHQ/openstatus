import type { Metadata } from "next";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { PublicLayout } from "@/components/layout/public-layout";

export const metadata: Metadata = {
  ...defaultMetadata,
  twitter: {
    ...twitterMetadata,
  },
  openGraph: {
    ...ogMetadata,
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: move first sticky Shell into here
  // that will allow to use a loading state and have it already
  return <PublicLayout>{children}</PublicLayout>;
}
