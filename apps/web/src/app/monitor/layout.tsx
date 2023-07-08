import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

// same layout as /play
export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
      <div className="z-10 flex w-full flex-1 flex-col items-start justify-center">
        <Button asChild variant="link" className="group mb-1">
          <Link href="/">
            <ChevronLeft className="text-muted-foreground group-hover:text-foreground mr-1 h-4 w-4" />{" "}
            Back
          </Link>
        </Button>
        <div className="border-border w-full rounded-lg border p-3 backdrop-blur-[2px] md:p-6">
          {children}
        </div>
      </div>
      <Footer />
    </main>
  );
}
