import path from "path";
import {authMiddleware} from "../middlewares/auth-middleware";
import {jwtSecret, userService} from "../config";
import {
    Router,
    ErrorRequestHandler,
    Request,
    Response,
    NextFunction,
} from "express";
import multer from "multer";
import {HttpError} from "../errors/http-error";
import {AuthorizedUser} from "../models/profile/authorized-user";
import {ErrorCode} from "../errors/error-codes";
import {zodProfileDto} from "../models/profile/edit-profile-dto";
import {zodPostRequest} from "../models/post/post-request";
import {string} from "zod";
import {postService} from "../config";
import {zodEditPostRequest} from "../models/post/edit-post-request";
import {EditProfileDto} from "../models/profile/edit-profile-dto";

export const fileRouter = Router();

const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    },
    limits: {
        fileSize: 1024 * 1024 * 4,
    },
});

fileRouter.use(authMiddleware);

fileRouter.post(
    "/myProfile",
    upload.single("profileImage"),
    async (req: Request, res, next) => {
        try {
            if (!req.user) {
                throw new HttpError(
                    401,
                    ErrorCode.UNAUTHORIZED,
                    "Not authorized",
                );
            }
            const fields = JSON.parse(req.body["profileFields"]);
            let profileDto: EditProfileDto;
            if (!req.file) {
                profileDto = zodProfileDto.parse({
                    ...fields,
                    userName: req.user.userName,
                });
            } else {
                const imageUrl = `/api/files/${req.file.filename}`;
                profileDto = zodProfileDto.parse({
                    ...fields,
                    profileImage: imageUrl,
                    userName: req.user.userName,
                });
            }
            const updatedProfile = await userService.editProfile(
                profileDto,
                req.user,
            );
            res.status(200).send(updatedProfile);
        } catch (err) {
            next(err);
        }
    },
);

fileRouter.post(
    "/addPost",
    upload.array("photoFiles", 10),
    async (req: Request, res, next) => {
        try {
            if (!req.user) {
                throw new HttpError(
                    401,
                    ErrorCode.UNAUTHORIZED,
                    "Not authorized",
                );
            }
            const files = req.files as Express.Multer.File[];
            const photoUrls: string[] = [];
            if (!req.files) {
                res.status(500).send();
                return;
            }
            files.forEach((f) => {
                photoUrls.push(`/api/files/${f.filename}`);
            });

            const fields = JSON.parse(req.body["postFields"]);
            const postRequest = zodPostRequest.parse({
                ...fields,
                photoUrls,
                userName: req.user.userName,
            });
            const newPost = await postService.addPost(postRequest);

            if (!newPost) {
                res.status(500).send();
            }
            res.status(200).send(newPost);
        } catch (err) {
            next(err);
        }
    },
);

fileRouter.post(
    "/editPost",
    upload.array("photoFiles", 10),
    async (req: Request, res, next) => {
        try {
            if (!req.user) {
                throw new HttpError(
                    401,
                    ErrorCode.UNAUTHORIZED,
                    "Not authorized",
                );
            }
            const files = req.files as Express.Multer.File[];

            const fields = JSON.parse(req.body["postFields"]);
            const postRequest = zodEditPostRequest.parse({
                ...fields,
                userName: req.user.userName,
            });
            if (req.files) {
                files.forEach((f) => {
                    postRequest.photoUrls.push(`/api/files/${f.filename}`);
                });
            }
            const edittedPost = await postService.editPost(
                postRequest,
                req.user.userName,
            );

            if (!edittedPost) {
                res.status(500).send();
            }
            res.status(200).send(edittedPost);
        } catch (err) {
            next(err);
        }
    },
);

fileRouter.get("/:fileName", (req, res, next) => {
    try {
        const filePath = path.join(
            __dirname,
            "..",
            "..",
            "uploads",
            req.params.fileName,
        );

        res.status(200).download(filePath);
    } catch (err) {
        next();
    }
});
