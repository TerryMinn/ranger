"use client";

import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getApiBaseUrl } from "@/lib/api-url";

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl() || undefined,
  plugins: [adminClient()],
});
