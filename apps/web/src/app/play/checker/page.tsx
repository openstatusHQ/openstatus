import type { Metadata } from "next";

import { BackButton } from "@/components/layout/back-button";
import CheckerPlay from "./_components/checker-play";

export const metadata: Metadata = {
  title: "Speed Checker",
  description:
    "Test the performance your api, website from multiple regions. Get speed insights for free.",
  openGraph: {
    title: "Speed Checker",
    description:
      "Test the performance your api, website from multiple regions. Get speed insights for free.",
  },
};

export default async function PlayPage() {
  return (
    <>
      <BackButton href="/" />
      <CheckerPlay />
    </>
  );
}
