import { createTRPCRouter } from "./trpc";
import { authRouter } from "./routers/auth";
import { dashboardRouter } from "./routers/dashboard";
import { postRouter } from "./routers/post";
import { userRouter } from "./routers/user";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  dashboard: dashboardRouter,
  post: postRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
