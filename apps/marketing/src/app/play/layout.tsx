import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Layout } from "@/components/layout/layout";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  ...defaultMetadata,
  twitter: {
    ...twitterMetadata,
  },
  openGraph: {
    ...ogMetadata,
  },
};

export default function PlayLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
