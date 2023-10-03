"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft } from "lucide-react";

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
  hasNextPage: boolean;
}

export function DataTablePagination({ hasNextPage }: DataTablePaginationProps) {
  const searchParams = useSearchParams();
  const offset = parseInt(searchParams.get("offset") || "0");

  const router = useRouter();
  const updateSearchParams = useUpdateSearchParams();

  const updateSearchParamsWithRouter = (
    query: Parameters<typeof updateSearchParams>[0],
  ) => {
    const updatedSearchParams = updateSearchParams(query);
    return () => {
      router.replace(`?${updatedSearchParams.toString()}`);
    };
  };

  const limit = parseInt(searchParams.get("limit") || "20");

  return (
    <div className="flex items-center justify-between px-2">
      <div />
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={limit + ""}
            onValueChange={(value) => {
              updateSearchParamsWithRouter({
                limit: value,
                offset: 0,
              })();
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((limit) => (
                <SelectItem key={limit} value={`${limit}`}>
                  {limit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {page} of {pageCount}
        </div> */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={updateSearchParamsWithRouter({ page: "1" })}
            disabled={!offset}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={updateSearchParamsWithRouter({
              offset: (offset / limit - 1) * limit,
            })}
            disabled={!offset}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={updateSearchParamsWithRouter({
              offset: (offset / limit + 1) * limit,
            })}
            disabled={!hasNextPage}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={updateSearchParamsWithRouter({ page: pageCount })}
            disabled={page === pageCount + ""}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button> */}
        </div>
      </div>
    </div>
  );
}
