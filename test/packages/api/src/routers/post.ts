import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../trpc";

const listInput = z
  .object({
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().nullish(),
  })
  .optional();

export const postRouter = createTRPCRouter({
  getAll: publicProcedure.input(listInput).query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 50;
    const cursor = input?.cursor;

    const posts = await ctx.db.post.findMany({
      take: limit + 1,
      where: { published: true },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | undefined;
    if (posts.length > limit) {
      const nextItem = posts.pop();
      nextCursor = nextItem?.id;
    }

    return { posts, nextCursor };
  }),

  getMyPosts: protectedProcedure.query(({ ctx }) => {
    return ctx.db.post.findMany({
      where: { authorId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().max(10000).optional(),
        imageUrl: z.string().url().optional(),
        published: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.post.create({
        data: {
          title: input.title,
          content: input.content || null,
          imageUrl: input.imageUrl ?? null,
          published: input.published,
          author: {
            connect: { id: ctx.session.user.id },
          },
        },
      });
    }),

  deleteMine: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.db.post.findUnique({
        where: { id: input.id },
        select: { id: true, authorId: true },
      });

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      }

      if (post.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot delete this post.",
        });
      }

      return ctx.db.post.delete({ where: { id: input.id } });
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
      return ctx.db.post.findMany({
        take: input?.limit ?? 100,
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  adminDelete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.post.delete({ where: { id: input.id } });
    }),
});
