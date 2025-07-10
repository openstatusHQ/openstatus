"use client";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Check, Copy } from "lucide-react";
import { z } from "zod";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";

const schema = z.object({
  slug: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function FormSlug({ defaultValues }: { defaultValues?: FormValues }) {
  const { copy, isCopied } = useCopyToClipboard();
  console.log({ defaultValues, schema });

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>Slug</FormCardTitle>
        <FormCardDescription>
          The unique slug for your workspace.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            copy(defaultValues?.slug ?? "unknown slug", {
              successMessage: "Copied slug to clipboard",
            })
          }
        >
          {defaultValues?.slug ?? "unknown slug"}
          {isCopied ? (
            <Check size={16} className="text-muted-foreground" />
          ) : (
            <Copy size={16} className="text-muted-foreground" />
          )}
        </Button>
      </FormCardContent>
      <FormCardFooter className="[&>:last-child]:ml-0">
        <FormCardFooterInfo>
          Used when interacting with the API or for help on Discord.{" "}
          <FormDialogSupportContact>
            <Button
              variant="ghost"
              size="sm"
              className="px-0 py-0 hover:bg-transparent dark:hover:bg-transparent text-accent-foreground"
            >
              Let us know
            </Button>
          </FormDialogSupportContact>{" "}
          if you&apos;d like to change it.
        </FormCardFooterInfo>
      </FormCardFooter>
    </FormCard>
  );
}
