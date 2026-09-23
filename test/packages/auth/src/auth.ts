import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { admin, bearer } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { nextCookies } from "better-auth/next-js";

import { db } from "@repo/db";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

const secret =
  process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

const appScheme = process.env.EXPO_APP_SCHEME ?? "test";
const apiPort = process.env.PORT ?? "3000";
const isDev = process.env.NODE_ENV !== "production";
const trustedOrigins = [
  baseURL.replace(/\/$/, ""),
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4000",
  "http://127.0.0.1:8081",
  ...(process.env.EXPO_APP_SCHEME || isDev
    ? [
        appScheme + "://",
        appScheme + "://*",
        "exp://",
        "exp://**",
        "exp://192.168.*.*:*/*",
        "exp://10.0.2.2:*/*",
        "exp://127.0.0.1:*/*",
        "exp://localhost:*/*",
        "http://10.0.2.2:" + apiPort,
      ]
    : []),
  ...(isDev
    ? [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:34115",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:34115",
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://wails.localhost",
        "http://wails.localhost:*",
        "wails://",
        "wails://*",
      ]
    : []),
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  secret,
  baseURL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
      },
      banned: {
        type: "boolean",
        required: false,
        input: false,
      },
    },
  },
  plugins: [admin(), bearer(), nextCookies(), expo()],
}) as unknown as ReturnType<typeof betterAuth>;
