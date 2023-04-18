import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  privateProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

export const postsRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
  getAll: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        pageSize: z.number().default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const posts = await ctx.prisma.post.findMany({
        take: input.pageSize + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { id: "desc" },
      });

      let nextCursor: typeof input.cursor | undefined = undefined;

      if (posts.length > input.pageSize) {
        const nextItem = posts.pop();
        nextCursor = nextItem?.id;
      }

      const postsAuthors = (
        await ctx.clerkClient.users.getUserList({
          userId: posts.map((post) => post.authorID),
        })
      ).map((author) => {
        return {
          id: author.id,
          userName: author.username ?? "username not found",
          profileImageUrl: author.profileImageUrl,
        };
      });

      const postsWithAuthors = posts.map((post) => {
        const author = postsAuthors.find(
          (author) => author.id === post.authorID
        );

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

      return { postsWithAuthors, nextCursor };
    }),
  create: privateProcedure
    .input(
      z.object({
        content: z.string().min(1).max(280),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorID = ctx.currentUserID;
      const { success } = await ratelimiter.limit(authorID);
      if (!success) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      await ctx.prisma.post.create({
        data: {
          authorID,
          content: input.content,
        },
      });
    }),
});
