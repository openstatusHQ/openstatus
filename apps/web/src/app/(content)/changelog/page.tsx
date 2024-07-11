import ChangelogClient from "./ChangelogClient";
import type { Metadata } from "next";
import { Shell } from "@/components/dashboard/shell";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Changelog",
  openGraph: {
    ...ogMetadata,
    title: "Changelog | OpenStatus",
  },
  twitter: {
    ...twitterMetadata,
    title: "Changelog | OpenStatus",
  },
};

export default function Changelog() {
  return (
    <Shell>
      <ChangelogClient />
    </Shell>
  );
}
