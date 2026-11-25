// Test double for next/navigation, swapped in via --import-map. Router calls
// are recorded on `routerCalls`; reset it between tests.
export const routerCalls: { method: string; args: unknown[] }[] = [];

function record(method: string) {
  return (...args: unknown[]) => {
    routerCalls.push({ method, args });
  };
}

const router = {
  push: record("push"),
  replace: record("replace"),
  refresh: record("refresh"),
  back: record("back"),
  forward: record("forward"),
  prefetch: record("prefetch"),
};

export const navigationState: {
  pathname: string;
  params: Record<string, string | string[]>;
  searchParams: URLSearchParams;
} = { pathname: "/", params: {}, searchParams: new URLSearchParams() };

export function useRouter() {
  return router;
}

export function usePathname() {
  return navigationState.pathname;
}

export function useParams() {
  return navigationState.params;
}

export function useSearchParams() {
  return navigationState.searchParams;
}

export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}

export function redirect(url: string): never {
  throw new Error(`NEXT_REDIRECT ${url}`);
}
