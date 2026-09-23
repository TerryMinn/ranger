import "server-only";

import { headers } from "next/headers";

import { appRouter, createCallerFactory } from "@repo/api";
import type { CreateContextOptions } from "@repo/api";
import { db } from "@repo/db";

import { getSession } from "@/server/auth";

export const createTRPCContext = async (): Promise<CreateContextOptions> => {
  const session = await getSession(await headers());

  return {
    session,
    db,
  };
};

export const createCaller = createCallerFactory(appRouter);
