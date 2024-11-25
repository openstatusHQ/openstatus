import "@openstatus/header-analysis";

import { Info } from "lucide-react";
import React from "react";

import {
  parseCacheControlHeader,
  parseCfCacheStatus,
  parseCfRay,
  parseFlyRequestId,
  parseXVercelCache,
  parseXVercelId,
} from "@openstatus/header-analysis";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/src/components/dialog";

const allowedHeaders = [
  "Cache-Control",
  "Cf-Cache-Status",
  "Cf-Ray",
  "X-Vercel-Cache",
  "X-Vercel-Id",
  "Location",
  "Fly-Request-Id",
];

export function ResponseHeaderAnalysis({
  headerKey,
  headers,
  status,
}: {
  headers: Record<string, string | undefined>;
  headerKey: string;
  status: number;
}) {
  const header = headers[headerKey];

  if (!header) return null;
  if (!allowedHeaders.includes(headerKey)) return null;

  return (
    <Dialog>
      <DialogTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground">
        <Info className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Header Analysis</DialogTitle>
          <DialogDescription>
            Breaking down the{" "}
            <code className="font-semibold">&quot;{headerKey}&quot;</code>{" "}
            header.
          </DialogDescription>
        </DialogHeader>
        {(() => {
          switch (headerKey) {
            case "Cache-Control":
              return <CacheControl header={header} />;
            case "Cf-Cache-Status":
              return <CfCacheStatus header={header} />;
            case "Cf-Ray":
              return <CfRay header={header} />;
            case "X-Vercel-Cache":
              return <XVercelCache header={header} />;
            case "X-Vercel-Id":
              return <XVercelId header={header} />;
            case "Fly-Request-Id":
              return <FlyRequestId header={header} />;
            case "Location":
              return <Location header={header} status={status} />;
            default:
              return null;
          }
        })()}
      </DialogContent>
    </Dialog>
  );
}

function CacheControl({ header }: { header: string }) {
  const values = parseCacheControlHeader(header);

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {values.map(({ name, value, description }) => {
        return (
          <React.Fragment key={name}>
            <p className="sm:col-span-1">
              <code className="rounded bg-muted p-1 font-semibold">{name}</code>{" "}
              {value !== undefined ? <code>({value})</code> : null}
            </p>
            <p className="sm:col-span-3">{description}</p>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CfCacheStatus({ header }: { header: string }) {
  const { value, description } = parseCfCacheStatus(header);

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <p className="sm:col-span-1">
        <code className="rounded bg-muted p-1 font-semibold">{value}</code>
      </p>
      <p className="sm:col-span-3">{description}</p>
    </div>
  );
}

function XVercelCache({ header }: { header: string }) {
  const { value, description } = parseXVercelCache(header);

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <p className="sm:col-span-1">
        <code className="rounded bg-muted p-1 font-semibold">{value}</code>
      </p>
      <p className="sm:col-span-3">{description}</p>
    </div>
  );
}

export function XVercelId({ header }: { header: string }) {
  const value = parseXVercelId(header);

  return (
    <div className="grid gap-4">
      <p className="col-span-full text-muted-foreground text-sm">
        This header contains a list of Edge regions your request hit, as well as
        the region the function was executed in (for both Edge and Serverless):
      </p>
      <div className="grid grid-cols-4 gap-3">
        {value.status === "failed" ? (
          <p className="text-destructive">{value.error.message}</p>
        ) : (
          value.data.map(({ code, location, flag }) => (
            <React.Fragment key={code}>
              <p className="sm:col-span-1">
                <code className="rounded bg-muted p-1 font-semibold">
                  {code}
                </code>
              </p>
              <p className="sm:col-span-3">
                {location} {flag}
              </p>
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

export function CfRay({ header }: { header: string }) {
  const value = parseCfRay(header);

  return (
    <div className="grid gap-4">
      <p className="col-span-full text-muted-foreground text-sm">
        This header is a hashed value that encodes information about the data
        center and the visitor’s request. The data center the request hit is:
      </p>
      {value.status === "failed" ? (
        <p className="text-destructive">{value.error.message}</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <p className="sm:col-span-1">
            <code className="rounded bg-muted p-1 font-semibold">
              {value.data.code}
            </code>
          </p>
          <p className="sm:col-span-3">
            {value.data.location} {value.data.flag}
          </p>
        </div>
      )}
    </div>
  );
}

export function Location({
  header,
  status,
}: {
  header: string;
  status: number;
}) {
  return (
    <div className="grid gap-4">
      <p className="col-span-full text-muted-foreground text-sm">
        This header in HTTP responses is used to redirect the client to a new
        URL. It is often seen with status codes like <code>301</code> (Moved
        Permanently) and <code>302</code> (Found), guiding the client&apos;s
        browser to navigate to a different location.
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        <p className="sm:col-span-1">
          <code className="rounded bg-muted p-1 font-semibold">{status}</code>
        </p>
        <p className="sm:col-span-3">{header}</p>
      </div>
    </div>
  );
}

export function FlyRequestId({ header }: { header: string }) {
  const value = parseFlyRequestId(header);

  return (
    <div className="grid gap-4">
      <p className="col-span-full text-muted-foreground text-sm">
        This header is a hashed value that encodes information about the data
        center and the visitor’s request. The data center the request hit is:
      </p>
      {value.status === "failed" ? (
        <p className="text-destructive">{value.error.message}</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <p className="sm:col-span-1">
            <code className="rounded bg-muted p-1 font-semibold">
              {value.data.code}
            </code>
          </p>
          <p className="sm:col-span-3">
            {value.data.location} {value.data.flag}
          </p>
        </div>
      )}
    </div>
  );
}
