import z from "zod";

export const zodCommentRequest = z.object({
    userName: z.string(),
    postId: z.string(),
    comment: z.string().nonempty(),
    parentCommentId: z.string(),
    page: z.number(),
    limit: z.number(),
})

export type CommentRequest = z.infer<typeof zodCommentRequest>