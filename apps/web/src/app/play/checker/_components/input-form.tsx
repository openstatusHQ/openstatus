import { redirect } from "next/navigation";

import { Input, Label } from "@openstatus/ui";

import { setCheckerData } from "../[id]/utils";
import { SubmitButton } from "./submit-button";

export function InputForm() {
  return (
    <form
      className="grid gap-2"
      action={async (data) => {
        "use server";
        let uuid: string | null = null;
        try {
          const url = data.get("url");
          if (url) {
            uuid = await setCheckerData(url.toString());
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (uuid) redirect(`/play/checker/${uuid}`);
        }
      }}
    >
      <Label htmlFor="url">URL</Label>
      <div className="flex w-full items-center space-x-2">
        <Input
          type="url"
          placeholder="https://documenso.com"
          name="url"
          id="url"
          className="w-full"
          required
        />
        <SubmitButton />
      </div>
      <p className="text-muted-foreground text-xs">
        Enter a URL to check the connection.
      </p>
    </form>
  );
}
