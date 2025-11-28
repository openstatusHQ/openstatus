"use client";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Button } from "@openstatus/ui";
import { Checkbox } from "@openstatus/ui";
import { Input } from "@openstatus/ui";
import { Label } from "@openstatus/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";
import { Textarea } from "@openstatus/ui";
import { Fragment, useState } from "react";

type Values = {
  url: string;
  method: string;
  body: string;
  headers: { key: string; value: string }[];
  verbose: boolean;
  insecure: boolean;
  json: boolean;
};

export function Form() {
  const [value, setValue] = useState<Values>({
    url: "",
    method: "GET",
    body: "",
    headers: [],
    verbose: false,
    insecure: false,
    json: false,
  });
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <form>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-1 space-y-1">
          <Label htmlFor="method" className="text-base">
            Method
          </Label>
          <Select
            name="method"
            defaultValue="GET"
            value={value.method}
            onValueChange={(value) =>
              setValue((v) => ({ ...v, method: value }))
            }
          >
            <SelectTrigger
              id="method"
              className="h-auto! w-full rounded-none p-4 text-base"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((method) => (
                <SelectItem
                  key={method}
                  value={method}
                  className="rounded-none px-2 py-3"
                >
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-4 space-y-1">
          <Label htmlFor="url" className="text-base">
            URL
          </Label>
          <Input
            name="url"
            id="url"
            placeholder="https://openstatus.dev"
            className="h-auto! rounded-none p-4 text-base md:text-base"
            value={value.url}
            onChange={(e) => setValue((v) => ({ ...v, url: e.target.value }))}
          />
        </div>
        <div className="col-span-5 space-y-1">
          <Label className="text-base">Headers</Label>
          <div className="grid grid-cols-5 gap-2">
            <Button
              type="button"
              variant="outline"
              className="col-span-2 h-auto! rounded-none p-4 text-base"
              onClick={() =>
                setValue((v) => ({
                  ...v,
                  headers: [...v.headers, { key: "", value: "" }],
                }))
              }
            >
              Add Header
            </Button>
            <div className="col-span-3" />
            {value.headers.map((header, index) => (
              <Fragment key={index}>
                <Input
                  placeholder="Key"
                  className="col-span-2 h-auto! rounded-none p-4 text-base md:text-base"
                  value={header.key}
                  onChange={(e) =>
                    setValue((v) => ({
                      ...v,
                      headers: v.headers.map((h, i) =>
                        i === index ? { ...h, key: e.target.value } : h,
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Value"
                  className="col-span-2 h-auto! rounded-none p-4 text-base md:text-base"
                  value={header.value}
                  onChange={(e) =>
                    setValue((v) => ({
                      ...v,
                      headers: v.headers.map((h, i) =>
                        i === index ? { ...h, value: e.target.value } : h,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full w-full rounded-none p-4 text-base"
                  onClick={() =>
                    setValue((v) => ({
                      ...v,
                      headers: v.headers.filter((_, i) => i !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </Fragment>
            ))}
          </div>
        </div>
        <div className="col-span-5 space-y-1">
          <Label htmlFor="body" className="text-base">
            Body
          </Label>
          <Textarea
            id="body"
            name="body"
            placeholder=""
            rows={6}
            className="resize-none rounded-none p-4 text-base md:text-base"
            value={value.body}
            onChange={(e) => setValue((v) => ({ ...v, body: e.target.value }))}
          />
        </div>
        <div className="col-span-5 space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="json-body"
              className="size-5 rounded-none"
              checked={value.json}
              onCheckedChange={(checked) =>
                setValue((v) => ({ ...v, json: Boolean(checked) }))
              }
            />
            <Label
              htmlFor="json-body"
              className="flex flex-col items-start gap-0 text-base"
            >
              <span>JSON Content-Type</span>
              <span className="text-muted-foreground">
                Set the Content-Type header to application/json.
              </span>
            </Label>
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="verbose"
              className="size-5 rounded-none"
              checked={value.verbose}
              onCheckedChange={(checked) =>
                setValue((v) => ({ ...v, verbose: Boolean(checked) }))
              }
            />
            <Label
              htmlFor="verbose"
              className="flex flex-col items-start gap-0 text-base"
            >
              <span>Verbose</span>
              <span className="text-muted-foreground">
                Make the operation more talkative.
              </span>
            </Label>
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="insecure"
              className="size-5 rounded-none"
              checked={value.insecure}
              onCheckedChange={(checked) =>
                setValue((v) => ({ ...v, insecure: Boolean(checked) }))
              }
            />
            <Label
              htmlFor="insecure"
              className="flex flex-col items-start gap-0 text-base"
            >
              <span>Accept self-signed certificats</span>
              <span className="text-muted-foreground">
                Allow insecure server connections.
              </span>
            </Label>
          </div>
        </div>
        <div className="col-span-5">
          <Textarea
            id="headers"
            name="headers"
            placeholder=""
            rows={3}
            className="resize-none rounded-none p-4 text-base md:text-base"
            value={generateCurlCommand(value)}
            readOnly
          />
        </div>
        <div className="col-span-5">
          <Button
            type="button"
            onClick={() => copy(generateCurlCommand(value), {})}
            className="h-full w-full rounded-none p-4 text-base"
          >
            {isCopied ? "Copied" : "Copy to Clipboard"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function generateCurlCommand(values?: Values) {
  if (!values) return "";

  const { method, url, body, verbose, insecure, json, headers } = values;

  let curlCommand = "curl";

  if (method) {
    curlCommand += ` -X ${method}`;
  }

  if (url) {
    curlCommand += ` "${url}" \\\n`;
  } else {
    // force a new line if there is no URL
    curlCommand += " \\\n";
  }

  for (const header of headers) {
    const { key, value } = header;
    if (key && value) {
      curlCommand += `  -H "${key}: ${value}" \\\n`;
    }
  }

  if (json) {
    curlCommand += '  -H "Content-Type: application/json" \\\n';
  }

  if (body?.trim()) {
    curlCommand += `  -d '${body.trim()}' \\\n`;
  }

  if (verbose) {
    curlCommand += "  -v \\\n";
  }

  if (insecure) {
    curlCommand += "  -k \\\n";
  }

  // Remove the trailing ` \` at the end
  return curlCommand.trim().slice(0, -2);
}
