"use client";

import { Bell, Mail, Rss } from "lucide-react";
import { useState } from "react";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/src/components/dropdown-menu";

import { Button } from "@openstatus/ui/src/components/button";
import { getBaseUrl } from "../utils";
import { SubscribeModal } from "./subscribe-modal";

interface Props {
  plan: WorkspacePlan;
  slug: string;
  customDomain?: string;
  passwordProtected?: boolean | null;
  isDemo?: boolean;
}

export function SubscribeButton({
  plan,
  slug,
  customDomain,
  passwordProtected = false,
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-full">
            <Bell className="h-4 w-4" />
            Subscribe
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!passwordProtected ? (
            <>
              <DropdownMenuItem asChild>
                <a
                  href={`${baseUrl}/feed/rss`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2"
                >
                  <Rss className="h-4 w-4" />
                  RSS
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`${baseUrl}/feed/atom`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2"
                >
                  <Rss className="h-4 w-4" />
                  Atom
                </a>
              </DropdownMenuItem>
            </>
          ) : null}
          {isSubscribers ? (
            <DropdownMenuItem onClick={() => setShowModal(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <SubscribeModal
        open={showModal}
        onOpenChange={setShowModal}
        slug={slug}
        isDemo={isDemo}
      />
    </>
  );
}
