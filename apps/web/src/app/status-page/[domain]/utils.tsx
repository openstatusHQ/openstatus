/**
 * While developing, we can also access the status page via /status-page/:domain
 */
export function setPrefixUrl(value: string, params: { domain: string }) {
  const suffix = value.startsWith("/") ? value : `/${value}`;
  if (process.env.NODE_ENV === "development") {
    return `/status-page/${params.domain}${suffix}`;
  }
  return suffix;
}
