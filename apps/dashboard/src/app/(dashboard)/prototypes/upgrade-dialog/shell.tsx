"use client";

import type { BillingInterval } from "@openstatus/db/src/schema/plan/schema";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Dialog, DialogContent } from "@openstatus/ui/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";

import { cn } from "@/lib/utils";

// Non-modal so the picker stays clickable; the harness draws the overlay.
export function Shell({
  className,
  onClose,
  children,
}: {
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn("max-h-[85vh]", className)}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target as Element | null;
          if (target?.closest(".proto-picker, [data-proto-chrome]")) {
            event.preventDefault();
          }
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function IntervalTabs({
  value,
  onChange,
  className,
}: {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as BillingInterval)}
      className={className}
    >
      <TabsList>
        <TabsTrigger value="monthly">Monthly</TabsTrigger>
        <TabsTrigger value="yearly">
          Yearly <Badge className="ml-1.5 text-[10px]">2 months free</Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
