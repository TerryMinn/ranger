import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Session } from "@repo/auth";
import type { db as dbClient } from "@repo/db";

export interface CreateContextOptions {
  session: Session | null;
  db: typeof dbClient;
}

const t = initTRPC.context<CreateContextOptions>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();

  if (process.env.NODE_ENV === "development") {
    console.log("[tRPC] " + path + " took " + (end - start) + "ms");
  }

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(enforceUserIsAuthed);

const STAFF_ROLES = ["admin", "owner", "manager", "staff"] as const;

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const userRole = ctx.session.user.role;

  if (!userRole || !STAFF_ROLES.includes(userRole as (typeof STAFF_ROLES)[number])) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  }

  return next();
});
