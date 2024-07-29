import React from "react";

import { Button } from "@openstatus/ui/src/components/button";

import { Kbd } from "../../kbd";
import { LoadingAnimation } from "../../loading-animation";

interface Props {
  onSubmit?: () => void;
  isPending?: boolean;
  isDirty?: boolean;
  form?: string;
}

export function SaveButton({ isPending, isDirty, onSubmit, form }: Props) {
  React.useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      // event.metaKey - pressed Command key on Macs
      // event.ctrlKey - pressed Control key on Linux or Windows
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        onSubmit?.();
      }
    };
    document.addEventListener("keydown", callback);
    return () => {
      document.removeEventListener("keydown", callback);
    };
    // no need to listen to `onSubmit` changes
  }, [onSubmit]);

  return (
    <div className="grid gap-3 sm:justify-end">
      <div className="flex flex-col gap-6 sm:col-span-full sm:flex-row sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          size="lg"
          type="submit"
          disabled={isPending}
          form={form}
        >
          {!isPending ? (
            <span className="flex items-center gap-2">
              Confirm
              <Kbd>
                <span className="mr-0.5">⌘</span>
                <span>S</span>
              </Kbd>
            </span>
          ) : (
            <LoadingAnimation />
          )}
        </Button>
      </div>
      {isDirty ? (
        <p className="text-muted-foreground text-xs">
          You have unsaved changes
        </p>
      ) : null}
    </div>
  );
}
