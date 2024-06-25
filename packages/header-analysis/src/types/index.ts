export type Region = {
  code: string;
  location: string;
  flag: string;
};

export type ParserReturn<T> =
  | { status: "success"; data: T }
  | { status: "failed"; error: Error };
