"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui";

import { ContactForm } from "./contact-form";

// @/components/ui/popover

export function Bubble() {
  const [open, setOpen] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  return (
    <div className="bg-background fixed bottom-4 right-4 z-50">
      <Popover
        open={open}
        onOpenChange={(value) => {
          // TODO: improve as if you do it quickly, it will still be visible and jump
          if (formVisible && !value) {
            setTimeout(() => setFormVisible(false), 300); // reset form after popover closes
          }
          setOpen(value);
        }}
      >
        <PopoverTrigger className="rounded-full border p-2 shadow">
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
              <p className="text-foreground font-medium">Need help?</p>
              <p className="text-muted-foreground text-sm">
                How do you want to contact us?
              </p>
              <Button variant="ghost" className="w-full" asChild>
                <a target="_blank" href="/docs">
                  Documentation
                </a>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <a target="_blank" href="/discord">
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
            <ContactForm />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
