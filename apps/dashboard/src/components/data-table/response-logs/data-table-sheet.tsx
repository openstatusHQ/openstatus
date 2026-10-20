"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { PrivateLocation } from "@openstatus/db/src/schema";
import { Check, Copy } from "@openstatus/icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@openstatus/ui/components/ui/accordion";
import { Button } from "@openstatus/ui/components/ui/button";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";

import {
  DataTableSheet,
  DataTableSheetContent,
  DataTableSheetFooter,
  DataTableSheetHeader,
  DataTableSheetTitle,
} from "@/components/data-table/data-table-sheet";
import { formatMilliseconds } from "@/lib/formatter";

import { DataTableBasics } from "./data-table-basics";

type ResponseLog = RouterOutputs["tinybird"]["get"]["data"][number];
type Attempt = RouterOutputs["tinybird"]["attempts"]["data"][number];

export function Sheet({
  data,
  attempts,
  privateLocations,
  onClose,
  showCopyUrl = true,
}: {
  data: ResponseLog | null;
  attempts?: Attempt[];
  privateLocations?: PrivateLocation[];
  onClose: () => void;
  showCopyUrl?: boolean;
}) {
  const { copy, isCopied } = useCopyToClipboard();
  if (!data) return null;

  return (
    <DataTableSheet defaultOpen onOpenChange={(open) => !open && onClose()}>
      <DataTableSheetContent className="sm:max-w-lg">
        <DataTableSheetHeader className="px-2">
          <DataTableSheetTitle>Response Logs</DataTableSheetTitle>
        </DataTableSheetHeader>
        <DataTableBasics
          data={data}
          privateLocations={privateLocations}
          attempts={attempts?.length ? attempts.length + 1 : undefined}
        />
        {attempts?.length ? (
          <PreviousAttempts
            attempts={attempts}
            privateLocations={privateLocations}
          />
        ) : null}
        {showCopyUrl ? (
          <>
            <Separator />
            <DataTableSheetFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    copy(window.location.href, {
                      withToast: false,
                    });
                  }
                }}
              >
                Copy Request Log URL
                {isCopied ? <Check /> : <Copy />}
              </Button>
            </DataTableSheetFooter>
          </>
        ) : null}
      </DataTableSheetContent>
    </DataTableSheet>
  );
}

function PreviousAttempts({
  attempts,
  privateLocations,
}: {
  attempts: Attempt[];
  privateLocations?: PrivateLocation[];
}) {
  return (
    <div className="border-t">
      <div className="text-muted-foreground px-2 py-2 text-sm font-medium">
        Previous attempts
      </div>
      <Accordion type="multiple" className="border-t">
        {attempts.map((attempt) => (
          <AccordionItem key={attempt.attempt} value={String(attempt.attempt)}>
            <AccordionTrigger className="px-2 py-2 font-mono">
              <span className="flex items-center gap-2">
                <span className="bg-destructive h-2.5 w-2.5 rounded-xs" />
                Attempt {attempt.attempt}
                <span className="text-muted-foreground">
                  {attemptSummary(attempt)}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <DataTableBasics
                data={attempt}
                privateLocations={privateLocations}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function attemptSummary(attempt: Attempt) {
  const latency = formatMilliseconds(attempt.latency);
  if (attempt.type === "http") {
    return `${attempt.statusCode ?? "no response"} · ${latency}`;
  }
  if (attempt.type === "grpc" && attempt.grpcCode !== null) {
    return `code ${attempt.grpcCode} · ${latency}`;
  }
  return latency;
}
