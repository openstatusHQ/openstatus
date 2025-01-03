"use client";

import { Bell, Mail, Rss } from "lucide-react";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";

import { Button } from "@openstatus/ui/src/components/button";
import { SubscribeModal } from "./subscribe-modal";
import { getBaseUrl } from "../utils";

interface Props {
  slug: string;
  customDomain?: string;
  isDemo?: boolean;
}

export function SubscribeButton({ slug, customDomain, isDemo = false }: Props) {
  const [showModal, setShowModal] = useState(false);
  const baseUrl = getBaseUrl({
    slug: slug,
    customDomain: customDomain,
  });

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="rounded-full gap-2">
            <Bell className="h-4 w-4" />
            Subscribe
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-0" align="end">
          <div className="flex flex-col">
            <a
              href={`${baseUrl}/feed/rss`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Rss className="h-4 w-4" />
              RSS
            </a>
            <a
              href={`${baseUrl}/feed/atom`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Rss className="h-4 w-4" />
              Atom
            </a>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <SubscribeModal
        open={showModal}
        onOpenChange={setShowModal}
        slug={slug}
        isDemo={isDemo}
      />
    </>
  );
}
