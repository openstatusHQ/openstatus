import type * as React from "react";

export interface SearchParams {
  [key: string]: string | string[] | undefined;
}

export interface Option {
  label: string;
  value: string | boolean;
}

export interface DataTableFilterField<TData> {
  label: string;
  value: keyof TData;
  component?: (props: Option) => JSX.Element | null;
  options?: Option[];
}

export interface DataTableFilterOption<TData> {
  id: string;
  label: string;
  value: keyof TData;
  options: Option[];
  filterValues?: string[];
  filterOperator?: string;
  isMulti?: boolean;
}
