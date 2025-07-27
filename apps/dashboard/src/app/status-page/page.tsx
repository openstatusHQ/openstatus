"use client";

import {
  FloatingButton,
  StatusPageProvider,
  useStatusPage,
} from "@/components/status-page/floating-button";
import {
  Status,
  StatusBanner,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusMonitor } from "@/components/status-page/status-monitor";

function StatusPageContent() {
  const { variant, cardType } = useStatusPage();

  return (
    <div className="grid gap-6">
      <Status variant={variant}>
        <StatusHeader>
          <StatusTitle>Craft</StatusTitle>
          <StatusDescription>
            Stay informed about the stability
          </StatusDescription>
        </StatusHeader>
        <StatusBanner />
        <StatusContent>
          <StatusMonitor variant={variant} type={cardType} />
        </StatusContent>
      </Status>
      <FloatingButton />
    </div>
  );
}

export default function Page() {
  return (
    <StatusPageProvider defaultVariant="success">
      <StatusPageContent />
    </StatusPageProvider>
  );
}
