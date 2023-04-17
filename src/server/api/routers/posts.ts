import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  privateProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postsRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.post.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
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
  create: privateProcedure
    .input(
      z.object({
        content: z.string().min(1).max(280),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorID = ctx.currentUserID;
      await ctx.prisma.post.create({
        data: {
          authorID,
          content: input.content,
        },
      });
    }),
});
