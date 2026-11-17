"use client";

import { ComingSoon } from "@/components/common/coming-soon";
import { NAV } from "@/config/nav";

export default function Page() {
  return (
    <ComingSoon
      title={NAV.onCall.label}
      icon={NAV.onCall.icon}
      description="Who gets paged, and when."
      pitch="Rotations, escalation policies and overrides, so the right person is woken up when a monitor fails."
      message="I'm interested in on-call. What I need: "
    />
  );
}
