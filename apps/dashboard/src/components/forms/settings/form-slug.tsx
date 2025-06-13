"use client";

import { Button } from "@/components/ui/button";
import {
  FormCard,
  FormCardContent,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardDescription,
  FormCardTitle,
} from "@/components/forms/form-card";

import { Check, Copy } from "lucide-react";
import { z } from "zod";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

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
            copy("easy-peasy", {
              successMessage: "Copied slug to clipboard",
            })
          }
        >
          easy-peasy
          {isCopied ? (
            <Check size={16} className="text-muted-foreground" />
          ) : (
            <Copy size={16} className="text-muted-foreground" />
          )}
        </Button>
      </FormCardContent>
      <FormCardFooter className="[&>:last-child]:ml-0">
        <FormCardFooterInfo>
          Used when interacting with the API or for help on Discord.
        </FormCardFooterInfo>
      </FormCardFooter>
    </FormCard>
  );
}
