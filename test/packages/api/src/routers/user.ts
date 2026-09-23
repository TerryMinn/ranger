import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../trpc";

const publicUserSelect = {
  id: true,
  name: true,
  image: true,
  createdAt: true,
} as const;

const privateUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  banned: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }

    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: privateUserSelect,
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
        select: publicUserSelect,
      });
    }),

  adminList: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(100),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      return ctx.db.user.findMany({
        take: input?.limit ?? 100,
        orderBy: { createdAt: "desc" },
        select: privateUserSelect,
      });
    }),
});
