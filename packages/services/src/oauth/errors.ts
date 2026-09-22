import { ServiceError } from "../errors";

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "invalid_target"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "access_denied";

/**
 * RFC 6749 error. When `redirectUri` is set the authorize request had a
 * valid client and redirect target, so the error travels back to the
 * client instead of rendering as a 400.
 */
export class OAuthError extends ServiceError {
  public readonly oauthCode: OAuthErrorCode;
  public readonly redirectUri?: string;
  public readonly state?: string;

  constructor(
    oauthCode: OAuthErrorCode,
    message: string,
    redirect?: { redirectUri: string; state?: string | null },
  ) {
    super(
      oauthCode === "invalid_client" ? "UNAUTHORIZED" : "VALIDATION",
      message,
    );
    this.oauthCode = oauthCode;
    this.redirectUri = redirect?.redirectUri;
    this.state = redirect?.state ?? undefined;
  }
}
