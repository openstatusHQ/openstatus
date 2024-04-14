"use client";

import Image from "next/image";
import { useSelectedLayoutSegment } from "next/navigation";

import type { PublicPage } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";
import type { WorkspacePlan } from "@openstatus/plans";

import { Shell } from "@/components/dashboard/shell";
import { TabsContainer, TabsLink } from "@/components/dashboard/tabs-link";
import { SubscribeButton } from "./_components/subscribe-button";
import { Menu } from "./menu";

type Props = {
  navigation: {
    label: string;
    href: string;
    segment: string | null;
    disabled?: boolean;
  }[];
  plan: WorkspacePlan;
  page: PublicPage;
};

export function Header({ navigation, plan, page }: Props) {
  const selectedSegment = useSelectedLayoutSegment();
  const isSubscribers = allPlans[plan].limits["status-subscribers"];

  return (
    <header className="w-full">
      <Shell className="flex items-center justify-between gap-4 px-3 py-3 md:px-6 md:py-3">
        <div className="relative sm:w-[100px]">
          {page?.icon ? (
            <div className="bg-muted border-border flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border">
              <Image
                height={36}
                width={36}
                src={page.icon}
                alt={page.title}
                className="object-cover"
              />
            </div>
          ) : null}
        </div>
        <TabsContainer className="-mb-[13px] hidden sm:block" hideSeparator>
          {navigation.map(({ label, href, disabled, segment }) => {
            const active = segment === selectedSegment;
            return (
              <TabsLink key={segment} {...{ active, href, label, disabled }}>
                {label}
              </TabsLink>
            );
          })}
        </TabsContainer>
        <div className="flex items-center gap-4">
          <div className="text-end sm:w-[100px]">
            {isSubscribers ? <SubscribeButton slug={page.slug} /> : null}
          </div>
          <div className="block sm:hidden">
            <Menu navigation={navigation} />
          </div>
        </div>
      </Shell>
    </header>
  );
}
