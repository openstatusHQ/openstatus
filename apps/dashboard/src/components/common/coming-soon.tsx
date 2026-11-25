"use client";

import type { IconType } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";

import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";

/** Placeholder page for a nav item that has not shipped; visits show up as OpenPanel screen views. */
export function ComingSoon({
  id,
  title,
  description,
  icon: Icon,
  pitch,
  message,
}: {
  id: string;
  title: string;
  description: string;
  icon: IconType;
  pitch: string;
  /** prefills the support dialog */
  message: string;
}) {
  return (
    <SectionGroup>
      <Section id={id}>
        <SectionHeader>
          <SectionTitle>{title}</SectionTitle>
          <SectionDescription>{description}</SectionDescription>
        </SectionHeader>
        <EmptyStateContainer>
          <EmptyStateMedia>
            <Icon />
          </EmptyStateMedia>
          <EmptyStateTitle>{title} is coming soon</EmptyStateTitle>
          <EmptyStateDescription>{pitch}</EmptyStateDescription>
          <EmptyStateActions>
            <FormDialogSupportContact
              defaultValues={{ type: "feature", message }}
            >
              <Button size="sm">Tell us what you need</Button>
            </FormDialogSupportContact>
          </EmptyStateActions>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
