"use client";

import { MarketingLayout } from "@/components/layout/marketing-layout";

import { InputSearch } from "./_components/search";

export default function TestPage() {
  return (
    <MarketingLayout>
      <div className="min-h-full w-full bg-background border border-border rounded-md p-6">
        <InputSearch
          events={[]}
          onSearch={(value) => {
            console.log(value);
          }}
        />
      </div>
    </MarketingLayout>
  );
}
