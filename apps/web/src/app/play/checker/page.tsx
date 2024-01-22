import type { Metadata } from "next";

import { BackButton } from "@/components/layout/back-button";
import CheckerPlay from "./_components/checker-play";

export const metadata: Metadata = {
  title: "Speed Checker",
  description:
    "Get speed insights for your api, website from multiple regions.",
};

export default async function PlayPage() {
  return (
    <>
      <BackButton href="/" />
      <CheckerPlay />
    </>
  );
}
