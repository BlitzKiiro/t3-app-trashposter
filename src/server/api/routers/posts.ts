import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const postsRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.post.findMany({ take: 100 });
    const postsAuthors = (
      await ctx.clerkClient.users.getUserList({
        userId: posts.map((post) => post.authorID),
        limit: 100,
      })
    ).map((author) => {
      return {
        id: author.id,
        userName: author.username ?? "username not found",
        profileImageUrl: author.profileImageUrl,
      };
    });

    return posts.map((post) => {
      const author = postsAuthors.find((author) => author.id === post.authorID);

      if (!author)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "post author not found",
        });
      return {
        post,
        author,
      };
    });
  }),
  getMe: publicProcedure.query(({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "An unexpected error occurred, please try again later.",
      });
    }

    return ctx.clerkClient.users.getUser(ctx.auth.userId);
  }),
});
