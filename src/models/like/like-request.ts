import z from "zod";

export const zodLikeRequest = z.object({
    userName: z.string(),
    postId: z.string(),
    isLike: z.boolean(),
});

export type LikeRequest = z.infer<typeof zodLikeRequest>;

export type LikeDto = {
    userName: string;
    postId: string;
    isDeleted: boolean;
};
