import { redirect } from "next/navigation";

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { setCheckerData } from "../[id]/utils";
import { SubmitButton } from "./submit-button";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

export function InputForm() {
  return (
    <form
      className="grid gap-2"
      action={async (data) => {
        "use server";
        let uuid: string | null = null;
        try {
          const url = data.get("url");
          const method = data.get("method");
          console.log({ url, method });
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
        <Select defaultValue={METHODS[0]}>
          {/* TODO: enabled http methods */}
          <SelectTrigger
            id="method"
            name="method"
            className="w-[120px]"
            disabled
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* TBD: remove type="url" and add InputWithAddons */}
        <Input
          className="placeholder:text-muted-foreground w-full rounded-md px-3 py-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          type="url"
          placeholder="https://documenso.com"
          name="url"
          id="url"
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
