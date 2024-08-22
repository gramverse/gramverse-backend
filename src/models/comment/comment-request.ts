import z from "zod";

export const zodCommentRequest = z.object({
    userName: z.string(),
    postId: z.string(),
    comment: z.string(),
    parrentCommentId: z.string(),
})

export type CommentRequest = z.infer<typeof zodCommentRequest>