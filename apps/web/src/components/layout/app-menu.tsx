"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@openstatus/ui/src/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui/src/components/sheet";

import { AppSidebar } from "./app-sidebar";

export function AppMenu() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]); // remove searchParams if not needed

  return (
    <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-left">Navigation</SheetTitle>
        </SheetHeader>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
}
