import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "@repo/auth";

import { createTRPCRouter, publicProcedure } from "../trpc";

const registerInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRouter = createTRPCRouter({
  register: publicProcedure.input(registerInput).mutation(async ({ input }) => {
    try {
      const name = input.name ?? input.email.split("@")[0] ?? "User";
      const result = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name,
        },
      });

      return {
        token: result.token,
        user: result.user,
      };
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error ? error.message : "Registration failed",
      });
    }
  }),

  login: publicProcedure.input(loginInput).mutation(async ({ input }) => {
    try {
      const result = await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
        },
      });

      return {
        token: result.token,
        user: result.user,
      };
    } catch {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }
  }),
});
