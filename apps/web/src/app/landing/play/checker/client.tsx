"use client";

import { createContext, useContext, useState } from "react";
import { Button } from "@openstatus/ui";
import { Input } from "@openstatus/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";
import { regionDict, type Region } from "@openstatus/regions";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Values = { region: string; latency: number; status: number };

type CheckerContextType = {
  values: Values[];
  setValues: React.Dispatch<React.SetStateAction<Values[]>>;
};

const CheckerContext = createContext<CheckerContextType>({
  values: [],
  setValues: () => {},
});

export function CheckerProvider({ children }: { children: React.ReactNode }) {
  const [values, setValues] = useState<Values[]>([]);
  return (
    <CheckerContext.Provider value={{ values, setValues }}>
      {children}
    </CheckerContext.Provider>
  );
}

export function useCheckerContext() {
  const context = useContext(CheckerContext);
  if (!context) {
    throw new Error("useCheckerContext must be used within a CheckerProvider");
  }
  return context;
}

export function Form() {
  const { setValues } = useCheckerContext();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const url = formData.get("url") as string;
    const method = formData.get("method") as string;

    console.log(url, method);

    setValues([]);

    const r = Object.values(regionDict).map((region) => {
      const latency = Math.random() * 1000;
      const status = Math.random() < 0.9 ? 200 : 500;
      return { region: region, latency, status };
    });

    r.forEach((value) => {
      setTimeout(() => {
        setValues((prev) => [
          ...prev,
          {
            region: value.region.code,
            latency: value.latency,
            status: value.status,
          },
        ]);
      }, value.latency);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        <div className="col-span-1">
          <Select name="method" defaultValue="GET">
            <SelectTrigger className="h-auto! w-full rounded-none p-4 text-base">
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
        <div className="col-span-2 md:col-span-3">
          <Input
            name="url"
            placeholder="https://openstatus.dev"
            className="h-auto! rounded-none p-4 text-base md:text-base"
          />
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Button
            type="submit"
            variant="default"
            className="h-full w-full rounded-none p-4 text-base"
          >
            Submit
          </Button>
        </div>
        {/* TOOD: add button to details */}
      </div>
    </form>
  );
}

export function ResultTable() {
  const { values } = useCheckerContext();
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th className="w-12" />
            <th>Region</th>
            <th className="text-right!">Latency</th>
          </tr>
        </thead>
        <tbody>
          {values.length === 0 ? (
            <tr>
              <td>
                <div className="size-4 bg-muted-foreground" />
              </td>
              <td>
                <br />
              </td>
              <td>
                <br />
              </td>
            </tr>
          ) : (
            values.map((value) => {
              const regionConfig = regionDict[value.region as Region];
              return (
                <tr key={value.region}>
                  <td>
                    <div
                      className={cn(
                        "size-4",
                        STATUS_CODES[
                          value.status.toString()[0] as keyof typeof STATUS_CODES
                        ]
                      )}
                    />
                  </td>
                  <td>
                    {regionConfig.flag} {regionConfig.code}{" "}
                    <span className="text-muted-foreground">
                      {regionConfig.location}
                    </span>
                  </td>
                  <td className="text-right!">
                    {Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 0,
                    }).format(value.latency)}
                    ms
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <caption>Results of your check</caption>
      </table>
    </div>
  );
}

const STATUS_CODES = {
  "1": "bg-muted-foreground",
  "2": "bg-success",
  "3": "bg-info",
  "4": "bg-warning",
  "5": "bg-destructive",
};

export function ResponseStatus() {
  return (
    <div className="flex gap-2">
      {Object.entries(STATUS_CODES).map(([code, className]) => (
        <div key={code} className={cn("text-background text-base", className)}>
          {code}xx
        </div>
      ))}
    </div>
  );
}

export function DetailsButtonLink() {
  const { values } = useCheckerContext();

  if (values.length !== Object.keys(regionDict).length) {
    return null;
  }
  return (
    <Button
      variant="default"
      className="h-full w-full rounded-none p-4 text-base"
      asChild
    >
      <Link
        href="/landing/play/checker/1"
        className="no-underline! text-background!"
      >
        Response details
      </Link>
    </Button>
  );
}
