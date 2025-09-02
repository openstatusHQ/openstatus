"use client";

import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { variant } = useStatusPage();
  return (
    <Status variant={variant}>
      <StatusHeader>
        <StatusTitle>Craft</StatusTitle>
        <StatusDescription>Stay informed about the stability</StatusDescription>
      </StatusHeader>
      <StatusContent>{children}</StatusContent>
    </Status>
  );
}
