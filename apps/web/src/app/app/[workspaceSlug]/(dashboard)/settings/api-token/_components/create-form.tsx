"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { toastAction } from "@/lib/toast";
import { copyToClipboard } from "@/lib/utils";
import { create } from "./actions";
import { SubmitButton } from "./submit-button";

export function CreateForm({ ownerId }: { ownerId: number }) {
  const [rawKey, setRawKey] = React.useState<string | undefined>();
  const router = useRouter();
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);

  async function onCreate() {
    try {
      const res = await create(ownerId);
      if (!res) toastAction("error");
      if (res?.result) {
        setRawKey(res.result.key);
      }
    } catch {
      toastAction("error");
    }
  }

  return (
    <>
      <form action={onCreate}>
        <SubmitButton>Create</SubmitButton>
      </form>
      <AlertDialog
        open={Boolean(rawKey)}
        onOpenChange={() => setRawKey(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Api Key</AlertDialogTitle>
            <AlertDialogDescription>
              Please make sure to store the API key safely. You will only be
              able to see it once. If you forgot to safe it, you will need to
              revoke and recreate a key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <button
              type="button"
              className="group inline-flex items-center p-2"
              onClick={() => {
                copyToClipboard(String(rawKey));
                setHasCopied(true);
              }}
            >
              <span className="ph-no-capture font-mono">{rawKey}</span>
              {!hasCopied ? (
                <Icons.copy className="ml-2 hidden h-4 w-4 group-hover:block" />
              ) : (
                <Icons.check className="ml-2 h-4 w-4" />
              )}
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                router.refresh();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
