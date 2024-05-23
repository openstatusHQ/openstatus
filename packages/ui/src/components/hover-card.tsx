"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import * as React from "react";

import { cn } from "../lib/utils";

const HoverCard = HoverCardPrimitive.Root;

// REMINDER: fixes the Safari 17.4. bug where portal floats somewhere
const HoverCardPortal = HoverCardPrimitive.Portal;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPortal>
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-64 rounded-md border p-4 shadow-md outline-none",
        className,
      )}
      {...props}
    />
  </HoverCardPortal>
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardPortal, HoverCardTrigger, HoverCardContent };
