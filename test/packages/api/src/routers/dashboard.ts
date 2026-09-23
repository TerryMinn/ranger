import { createTRPCRouter, adminProcedure } from "../trpc";

export const dashboardRouter = createTRPCRouter({
  summary: adminProcedure.query(async ({ ctx }) => {
    const [postCount, userCount, publishedPostCount] = await ctx.db.$transaction([
      ctx.db.post.count(),
      ctx.db.user.count(),
      ctx.db.post.count({ where: { published: true } }),
    ]);

    const latestPosts = await ctx.db.post.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      postCount,
      userCount,
      publishedPostCount,
      latestPosts,
    };
  }),
});
