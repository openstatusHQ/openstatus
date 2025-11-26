"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/src/components/select";
import { allPosts } from "content-collections";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "../search-params";

const categories = new Set(allPosts.map((post) => post.category));

export function CategorySelect() {
  const [{ category }, setSearchParams] = useQueryStates(searchParamsParsers, {
    shallow: false,
  });

  return (
    <Select
      value={category || "all"}
      onValueChange={async (e) => {
        await setSearchParams({
          category: e === "all" ? null : (e as typeof category),
          pageIndex: 0, // Reset to first page when category changes
        });
      }}
    >
      <SelectTrigger className="h-9 capitalize">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Categories</SelectItem>
        {Array.from(categories).map((category) => (
          <SelectItem key={category} value={category} className="capitalize">
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
