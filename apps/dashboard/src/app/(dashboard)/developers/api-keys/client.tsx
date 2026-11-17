"use client";

import { ArrowUpRight } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormApiKey } from "@/components/forms/settings/form-api-key";

import { TERRAFORM_DOCS } from "../constants";

export function Client() {
  return (
    <SectionGroup>
      <Section id="api">
        <SectionHeader>
          <SectionTitle>Authentication</SectionTitle>
          <SectionDescription>
            One key authenticates the REST API, the CLI, the Terraform provider
            and the MCP server.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <FormApiKey />
        </FormCardGroup>
      </Section>
      <Section id="terraform">
        <SectionHeader>
          <SectionTitle>Terraform</SectionTitle>
          <SectionDescription>
            Manage monitors, status pages and notifications as code with the
            openstatus provider. It authenticates with an API key.
          </SectionDescription>
        </SectionHeader>
        <div>
          <Button variant="outline" size="sm" asChild>
            <a href={TERRAFORM_DOCS} target="_blank" rel="noreferrer">
              Terraform provider docs
              <ArrowUpRight />
            </a>
          </Button>
        </div>
      </Section>
    </SectionGroup>
  );
}
