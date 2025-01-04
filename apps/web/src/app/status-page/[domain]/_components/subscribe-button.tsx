"use client";

import { Bell, Mail, Rss } from "lucide-react";
import { useState } from "react";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";

import { Button } from "@openstatus/ui/src/components/button";
import { getBaseUrl } from "../utils";
import { SubscribeModal } from "./subscribe-modal";

interface Props {
  plan: WorkspacePlan;
  slug: string;
  customDomain?: string;
  isDemo?: boolean;
}

export function SubscribeButton({
  plan,
  slug,
  customDomain,
  isDemo = false,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const isSubscribers = allPlans[plan].limits["status-subscribers"]; // FIXME: use the workspace.limits
  const baseUrl = getBaseUrl({
    slug: slug,
    customDomain: customDomain,
  });

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-full">
            <Bell className="h-4 w-4" />
            Subscribe
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-0" align="end">
          <div className="flex flex-col">
            <a
              href={`${baseUrl}/feed/rss`}
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Rss className="h-4 w-4" />
              RSS
            </a>
            <a
              href={`${baseUrl}/feed/atom`}
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Rss className="h-4 w-4" />
              Atom
            </a>

            {isSubscribers ? (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
            ) : null}
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
