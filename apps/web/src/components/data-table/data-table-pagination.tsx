"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";

interface DataTablePaginationProps {
  pageCount: number;
}

export function DataTablePagination({ pageCount }: DataTablePaginationProps) {
  const searchParams = useSearchParams();
  const page = useSearchParams().get("page") || "1";

  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  const page_size = searchParams.get("page_size") || "10";

  return (
    <div className="flex items-center justify-between px-2">
      <div />
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={page_size}
            onValueChange={(value) => {
              router.push(
                pathname +
                  "/" +
                  "?" +
                  updateSearchParams({
                    page_size: value,
                    page: 1,
                  }),
              );
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={page_size} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {page} of {pageCount}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => {
              router.push(
                pathname +
                  "/" +
                  "?" +
                  updateSearchParams({
                    page: "1",
                  }),
              );
            }}
            disabled={!(page > "1")}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              router.push(
                pathname +
                  "/" +
                  "?" +
                  updateSearchParams({
                    page: parseInt(page) - 1,
                  }),
              );
            }}
            disabled={!(page > "1")}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              console.log("nextpage");
              router.push(
                pathname +
                  "/" +
                  "?" +
                  updateSearchParams({
                    page: parseInt(page) + 1,
                  }),
              );
            }}
            disabled={page === pageCount + ""}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => {
              console.log("lastpage");
              router.push(
                pathname +
                  "/" +
                  "?" +
                  updateSearchParams({
                    page: pageCount,
                  }),
              );
            }}
            disabled={page === pageCount + ""}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
