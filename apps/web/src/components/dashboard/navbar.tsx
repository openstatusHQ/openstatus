"use client";

import * as React from "react";
import { useSelectedLayoutSegment } from "next/navigation";

import { TabsContainer, TabsLink } from "./tabs-link";

type Props = {
  // TODO: add disabled state for pro/hobby plan users
  navigation: { label: string; href: string; segment: string | null }[];
  className?: string;
};

export const Navbar = ({ navigation, className }: Props) => {
  const selectedSegment = useSelectedLayoutSegment();

  return (
    <TabsContainer className={className}>
      {navigation.map(({ label, href, segment }) => {
        const active = segment === selectedSegment;
        return (
          <TabsLink key={href} href={href} active={active}>
            {label}
          </TabsLink>
        );
      })}
    </TabsContainer>
  );
};
