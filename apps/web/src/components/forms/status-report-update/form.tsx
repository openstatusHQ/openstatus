"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import type { InsertStatusReportUpdate } from "@openstatus/db/src/schema";
import { insertStatusReportUpdateSchema } from "@openstatus/db/src/schema";
import { Button, Form } from "@openstatus/ui";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import { General } from "./general";
import { SectionDate } from "./section-date";
import { SectionMessage } from "./section-message";

interface Props {
  defaultValues?: InsertStatusReportUpdate;
  statusReportId: number;
  onSubmit?: () => void;
}

export function StatusReportUpdateForm({
  defaultValues,
  statusReportId,
  onSubmit,
}: Props) {
  const form = useForm<InsertStatusReportUpdate>({
    resolver: zodResolver(insertStatusReportUpdateSchema),
    defaultValues: {
      id: defaultValues?.id || 0,
      status: defaultValues?.status || "investigating",
      message: defaultValues?.message,
      date: defaultValues?.date || new Date(),
      statusReportId,
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = ({ ...props }: InsertStatusReportUpdate) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.statusReport.updateStatusReportUpdate.mutate({ ...props });
        } else {
          await api.statusReport.createStatusReportUpdate.mutate({ ...props });
        }
        toastAction("saved");
        onSubmit?.();
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          form.handleSubmit(handleSubmit)(e);
        }}
        className="grid w-full gap-6"
      >
        <General form={form} />
        <Tabs defaultValue="message">
          <TabsList>
            <TabsTrigger value="message">Message</TabsTrigger>
            <TabsTrigger value="date">Date & Time</TabsTrigger>
          </TabsList>
          <TabsContent value="message">
            <SectionMessage form={form} />
          </TabsContent>
          <TabsContent value="date">
            <SectionDate form={form} />
          </TabsContent>
        </Tabs>
        <Button className="w-full sm:w-auto" size="lg">
          {!isPending ? "Confirm" : <LoadingAnimation />}
        </Button>
      </form>
    </Form>
  );
}
