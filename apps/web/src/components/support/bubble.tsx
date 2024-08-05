"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";

import { Button } from "@openstatus/ui/src/components/button";
import { useSession } from "next-auth/react";
import { ContactForm } from "./contact-form";

export function Bubble() {
  const [open, setOpen] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const session = useSession();

  return (
    <div className="fixed right-4 bottom-4 z-50 rounded-full bg-background">
      <Popover
        open={open}
        onOpenChange={(value) => {
          if (formVisible && !value) {
            setTimeout(() => setFormVisible(false), 300); // reset form after popover closes
          }
          setOpen(value);
        }}
      >
        <PopoverTrigger className="rounded-full border p-2 shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <MessageCircle className="h-6 w-6" />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={8}
          align="end"
          alignOffset={0}
          className={formVisible ? "w-80" : undefined}
        >
          {!formVisible ? (
            <div className="space-y-2">
              <p className="font-medium text-foreground">Need help?</p>
              <p className="text-muted-foreground text-sm">
                We are here to help you with any questions you may have.
              </p>
              <Button variant="ghost" className="w-full" asChild>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href="https://cal.com/team/openstatus/30min"
                >
                  Book a call
                </a>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href="https://docs.openstatus.dev"
                >
                  Browse documentation
                </a>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <a target="_blank" rel="noreferrer" href="/discord">
                  Join Discord
                </a>
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setFormVisible((prev) => !prev)}
              >
                Get in touch
              </Button>
            </div>
          ) : (
            <ContactForm
              defaultValues={{
                name:
                  session?.data?.user?.name ||
                  `${session?.data?.user?.firstName} ${session?.data?.user?.lastName}`,
                email: session?.data?.user?.email ?? undefined,
              }}
              onSubmit={() => setOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
