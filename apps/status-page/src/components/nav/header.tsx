"use client";

import { Link } from "@/components/common/link";
import {
  type StatusUpdateType,
  StatusUpdates,
} from "@/components/status-page/status-updates";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Menu, MessageCircleMore } from "lucide-react";
import NextLink from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Page = RouterOutputs["statusPage"]["get"];

function useNav() {
  const pathname = usePathname();
  const prefix = usePathnamePrefix();

  return [
    {
      label: "Status",
      href: `/${prefix}`,
      isActive: pathname === `/${prefix}`,
    },
    {
      label: "Events",
      href: `${prefix ? `/${prefix}` : ""}/events`,
      isActive: pathname.startsWith(`${prefix ? `/${prefix}` : ""}/events`),
    },
    {
      label: "Monitors",
      href: `${prefix ? `/${prefix}` : ""}/monitors`,
      isActive: pathname.startsWith(`${prefix ? `/${prefix}` : ""}/monitors`),
    },
  ];
}

function getStatusUpdateTypes(page: Page): StatusUpdateType[] {
  if (!page) return [];

  // NOTE: rss or json are not supported because of authentication
  if (page?.accessType === "email-domain") {
    return ["email"] as const;
  }

  if (page?.workspacePlan === "free") {
    return ["slack", "rss", "json"] as const;
  }

  return ["email", "slack", "rss", "json"] as const;
}

export function Header(props: React.ComponentProps<"header">) {
  const trpc = useTRPC();
  const { domain } = useParams<{ domain: string }>();
  const { data: page } = useQuery({
    ...trpc.statusPage.get.queryOptions({ slug: domain }),
  });

  const sendVerificationEmailMutation = useMutation(
    trpc.emailRouter.sendPageSubscriptionVerification.mutationOptions({}),
  );

  const subscribeMutation = useMutation(
    trpc.pageSubscription.upsert.mutationOptions({
      onSuccess: (result) => {
        console.log("subscribeMutation onSuccess", result);
        if (!result.subscription.id) return;
        sendVerificationEmailMutation.mutate(
          { id: result.subscription.id },
          {
            onError: (error) => {
              if (isTRPCClientError(error)) {
                toast.error(error.message);
              } else {
                toast.error("Failed to send verification email");
              }
            },
          },
        );
      },
    }),
  );

  return (
    <header {...props}>
      <nav className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 py-2">
        {/* NOTE: same width as the `StatusUpdates` button */}
        <div className="flex w-[150px] shrink-0">
          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              size="icon"
              className="size-8 overflow-hidden"
              asChild
            >
              <Link
                href={page?.homepageUrl || "/"}
                target={page?.homepageUrl ? "_blank" : undefined}
                rel={page?.homepageUrl ? "noreferrer" : undefined}
              >
                {page?.icon ? (
                  <img
                    src={page.icon}
                    alt={`${page.title} status page`}
                    className="size-8"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center font-mono">
                    {/* NOTE: show the first two letters of the title and if its multiple words, show the first letter of the first two words */}
                    {page?.title
                      ?.split(" ")
                      .map((word) => word.charAt(0))
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
              </Link>
            </Button>
          </div>
        </div>
        <NavDesktop className="hidden md:flex" />
        <div className="flex min-w-[150px] items-center justify-end gap-2">
          {page?.contactUrl ? (
            <GetInTouch buttonType="icon" link={page.contactUrl} />
          ) : null}
          <StatusUpdates
            types={getStatusUpdateTypes(page)}
            onSubscribe={async (email) => {
              if (!page?.id) return;
              await subscribeMutation.mutateAsync({
                email,
                pageId: page.id,
              });
            }}
            page={page}
          />
          <NavMobile className="md:hidden" />
        </div>
      </nav>
    </header>
  );
}

function NavDesktop({ className, ...props }: React.ComponentProps<"ul">) {
  const nav = useNav();
  return (
    <ul className={cn("flex flex-row gap-0.5", className)} {...props}>
      {nav.map((item) => {
        return (
          <li key={item.label}>
            <Button
              variant={item.isActive ? "secondary" : "ghost"}
              className={cn(
                "border",
                item.isActive ? "border-input" : "border-transparent",
              )}
              size="sm"
              asChild
            >
              <NextLink href={item.href}>{item.label}</NextLink>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function NavMobile({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const nav = useNav();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn("size-8 border", className)}
          {...props}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader className="border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-4">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              return (
                <li key={item.label} className="w-full">
                  <Button
                    variant={item.isActive ? "secondary" : "ghost"}
                    onClick={() => setOpen(false)}
                    className="w-full justify-start"
                    size="sm"
                    asChild
                  >
                    <NextLink href={item.href}>{item.label}</NextLink>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function GetInTouch({
  buttonType,
  className,
  link,
  ...props
}: React.ComponentProps<typeof Button> & {
  buttonType: "icon" | "text";
  link: string;
}) {
  if (buttonType === "text") {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        className={className}
        asChild
        {...props}
      >
        <a href={link} target="_blank" rel="noreferrer">
          Get in touch
        </a>
      </Button>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className={cn("size-8", className)}
            asChild
            {...props}
          >
            <a href={link} target="_blank" rel="noreferrer">
              <MessageCircleMore />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Get in touch</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
