"use client";

import type { PutBlobResult } from "@vercel/blob";
import Image from "next/image";
import * as React from "react";
import { useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertPage } from "@openstatus/db/src/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { BarDescription } from "@/components/tracker/tracker";
import { MousePointer2 } from "lucide-react";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertPage>;
}

export function SectionAdvanced({ form }: Props) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  /**
   * Determine the width and height of the uploaded image - it ideally is a square
   */
  const getFileDimensions = async (file: File) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  };

  const handleChange = async (file: FileList | null) => {
    if (!file || file.length === 0) {
      return;
    }

    const { height, width } = await getFileDimensions(file[0]);

    // remove rounding issues from transformations
    if (!(Math.abs(height - width) <= 1)) {
      setOpen(true);
      setFile(file[0]);
      return;
    }

    const newblob = await handleUpload(file[0]);
    form.setValue("icon", newblob.url);
  };

  const handleUpload = async (file: File) => {
    const response = await fetch(`/api/upload?filename=${file.name}`, {
      method: "POST",
      body: file,
    });

    const newblob = (await response.json()) as PutBlobResult;
    return newblob;
  };

  const handleCancel = () => {
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    inputFileRef.current?.value && (inputFileRef.current.value = "");
  };

  const handleConfirm = async () => {
    if (file) {
      const newblob = await handleUpload(file);
      form.setValue("icon", newblob.url);
      setFile(null);
    }
    setOpen(false);
  };

  return (
    <div className="grid w-full gap-4 md:grid-cols-3">
      <SectionHeader
        title="Advanced Settings"
        description="Provide informations about what your status page is for. A favicon can be uploaded to customize your status page. It will be used as an icon on the header as well."
        className="md:col-span-full"
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem className="md:col-span-full">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input
                placeholder="Stay informed about our api and website health."
                {...field}
              />
            </FormControl>
            <FormDescription>
              Provide your users informations about it.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="icon"
        render={({ field }) => (
          <FormItem className="col-span-full md:col-span-1">
            <FormLabel>Favicon</FormLabel>
            <FormControl>
              <>
                {!field.value && (
                  <Input
                    type="file"
                    accept="image/x-icon,image/png"
                    ref={inputFileRef}
                    onChange={(e) => handleChange(e.target.files)}
                  />
                )}
                {field.value && (
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-sm border border-border p-1">
                      <Image
                        src={field.value}
                        width={64}
                        height={64}
                        alt="Favicon"
                      />
                    </div>
                    <Button
                      variant="link"
                      onClick={() => {
                        form.setValue("icon", "");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </>
            </FormControl>
            <FormDescription>Your status page favicon</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid w-full gap-4 md:col-span-full md:grid-cols-3 md:grid-rows-2">
        <SectionHeader
          title="Monitor Values Visibility"
          description={
            <>
              Toggle the visibility of the values on the status page. Share your{" "}
              <span className="font-medium text-foreground">uptime</span> and
              the{" "}
              <span className="font-medium text-foreground">
                number of request
              </span>{" "}
              to your endpoint.
            </>
          }
          className="md:col-span-2"
        />
        <div className="group flex flex-col justify-center gap-1 rounded-md border border-dashed p-3 md:row-span-2">
          <div className="flex flex-row items-center justify-center gap-2 text-muted-foreground group-hover:text-foreground">
            <MousePointer2 className="h-3 w-3" />
            <p className="text-sm">Hover State</p>
          </div>
          <div className="mx-auto max-w-[15rem]">
            <BarDescription
              label="Operational"
              day={new Date().toISOString()}
              count={5600}
              ok={5569}
              showValues={!!form.getValues("showMonitorValues")}
              barClassName="bg-status-operational"
              className="rounded-md border bg-popover p-2 text-popover-foreground shadow-md md:col-span-1"
            />
          </div>
        </div>
        <FormField
          control={form.control}
          name="showMonitorValues"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 md:col-span-2">
              <FormControl>
                <Checkbox
                  disabled={field.disabled}
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Show values</FormLabel>
                <FormDescription>
                  Share the numbers to your users.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      </div>
      <AlertDialog open={open} onOpenChange={(value) => setOpen(value)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incorrect image size</AlertDialogTitle>
            <AlertDialogDescription>
              For the best result, the image should be a square. You can still
              upload it, but it will be cropped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
