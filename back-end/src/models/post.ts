import z, { string } from 'zod'

export const zodPostDto = z.object({
    userName : z.string().nonempty(),
    photos : z.array(z.string()).nonempty(),
    caption : z.string().nonempty(),
    mentioned : z.string().nonempty()
});

export type PostDto = z.infer<typeof zodPostDto>  