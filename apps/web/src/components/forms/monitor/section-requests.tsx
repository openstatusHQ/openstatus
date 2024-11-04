"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import { monitorJobTypesSchema } from "@openstatus/db/src/schema";
import type { InsertMonitor } from "@openstatus/db/src/schema";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";

import { Alert, AlertDescription, AlertTitle, Badge } from "@openstatus/ui";
import { SectionHeader } from "../shared/section-header";
import { SectionRequestHTTP } from "./section-request-http";
import { SectionRequestTCP } from "./section-request-tcp";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  type: "create" | "update";
}

// TODO: add Dialog with response informations when pingEndpoint!

export function SectionRequests({ form, type }: Props) {
  const jobType = form.getValues("jobType");
  const [prevJobType, setPrevJobType] = React.useState(jobType);

  if (prevJobType !== jobType) {
    setPrevJobType(jobType);
    if (type === "create") {
      form.resetField("url");
      form.resetField("method");
      form.resetField("body");
      form.resetField("headers");
      form.resetField("headerAssertions");
      form.resetField("statusAssertions");
      form.resetField("textBodyAssertions");
    }
  }

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Request Settings"
        description={
          type === "create" ? (
            <>
              Create your{" "}
              <span className="font-medium font-mono text-foreground">
                HTTP
              </span>{" "}
              or{" "}
              <span className="font-medium font-mono text-foreground">TCP</span>{" "}
              request type. Add custom headers, payload and test your endpoint
              before submitting.{" "}
              <span className="font-medium">
                You will not be able to switch type after saving.
              </span>
            </>
          ) : (
            <>
              Update your{" "}
              <span className="font-medium font-mono text-foreground">
                {jobType?.toUpperCase()}
              </span>{" "}
              request. Add custom headers, payload and test your endpoint before
              submitting.
            </>
          )
        }
      />
      {type === "create" ? (
        <Tabs
          value={jobType}
          onValueChange={(value) => {
            const validate = monitorJobTypesSchema.safeParse(value);
            if (!validate.success) return;
            form.setValue("jobType", validate.data, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }}
        >
          <TabsList>
            <TabsTrigger value="http">HTTP</TabsTrigger>
            <TabsTrigger value="tcp">TCP</TabsTrigger>
          </TabsList>
          <TabsContent value="http">
            <SectionRequestHTTP {...{ form }} />
          </TabsContent>
          <TabsContent value="tcp">
            <SectionRequestTCP {...{ form }} />
          </TabsContent>
        </Tabs>
      ) : null}
      {type === "update"
        ? (() => {
            switch (jobType) {
              case "http":
                return <SectionRequestHTTP {...{ form }} />;
              case "tcp":
                return <SectionRequestTCP {...{ form }} />;
              default:
                return (
                  <Alert>
                    <AlertTitle>Missing Type</AlertTitle>
                    <AlertDescription>
                      The job type{" "}
                      <span className="font-mono text-foreground uppercase">
                        {jobType}
                      </span>{" "}
                      is missing. Please select a valid job type.
                    </AlertDescription>
                  </Alert>
                );
            }
          })()
        : null}
    </div>
  );
}
