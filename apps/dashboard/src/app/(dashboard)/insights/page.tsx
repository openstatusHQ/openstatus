"use client";

import { ComingSoon } from "@/components/common/coming-soon";
import { NAV } from "@/config/nav";

export default function Page() {
  return (
    <ComingSoon
      title={NAV.insights.label}
      icon={NAV.insights.icon}
      description="How your incidents and monitors trend over time."
      pitch="MTTA, MTTR, incident counts and noisy monitors across your workspace, month over month."
      message="I'm interested in insights. What I'd like to see: "
    />
  );
}
