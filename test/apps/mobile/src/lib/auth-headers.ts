import { authClient } from "./auth-client";

export function getAuthRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = authClient.getCookie();

  if (cookie) {
    headers.Cookie = cookie;
  }

  return headers;
}
