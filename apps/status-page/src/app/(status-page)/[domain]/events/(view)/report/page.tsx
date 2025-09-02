"use client";

import { formatDate } from "@/lib/formatter";

import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAside,
  StatusEventContent,
  StatusEventTimelineReport,
  StatusEventTitle,
} from "@/components/status-page/status-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusReports } from "@/data/status-reports";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Copy } from "lucide-react";
import Link from "next/link";

const report = statusReports[1];

export default function EventPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
        <BackButton />
        <CopyButton />
      </div>
      <StatusEvent>
        <StatusEventAside>
          <span className="font-medium text-foreground/80">
            {formatDate(report.startedAt, { month: "short" })}
          </span>
        </StatusEventAside>
        <StatusEventContent hoverable={false}>
          <StatusEventTitle>{report.name}</StatusEventTitle>
          <StatusEventAffected className="flex flex-wrap gap-1">
            {report.affected.map((affected) => (
              // TODO: use StatusEventAffectedBadge component
              <Badge key={affected} variant="outline" className="text-[10px]">
                {affected}
              </Badge>
            ))}
          </StatusEventAffected>
          <StatusEventTimelineReport updates={report.updates} />
        </StatusEventContent>
      </StatusEvent>
    </div>
  );
}

function BackButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-muted-foreground", className)}
      asChild
      {...props}
    >
      <Link href="/status-page/events">
        <ArrowLeft />
        Back
      </Link>
    </Button>
  );
}

function CopyButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() =>
        copy(window.location.href, {
          successMessage: "Link copied to clipboard",
        })
      }
      className={cn("size-8", className)}
      {...props}
    >
      {isCopied ? <Check /> : <Copy />}
      <span className="sr-only">Copy Link</span>
    </Button>
  );
}
