import {AuthorizedUser} from "../models/profile/authorized-user";
import {Router, Request} from "express";
import { HttpError } from "../errors/http-error";
import { ErrorCode } from "../errors/error-codes";
import { zodLikeRequest, LikeRequest } from '../models/like/like-request';
import { PostService } from '../services/post.service';
import { postService } from "../config";

declare module "express" {
    interface Request {
        user?: AuthorizedUser;
    }
}

export const postRouter = Router();

postRouter.post("/like", async (req: Request, res) => {
    try{
        let success;
        
        if (!req.user){
            throw new HttpError(401, ErrorCode.UNAUTHORIZED, "Not authorized");
        }
        const likeeUserName = req.body.userName;
        const likeePostId = req.body.postId;
        if (!likeeUserName){
            throw new HttpError(400, ErrorCode.MISSING_LIKEE_USERNAME, "Missing likee username")
        }
        if (!likeePostId){
            throw new HttpError(400, ErrorCode.MISSING_LIKEE_POSTID, "Missing likee postId")
        }
        const likeRequest : LikeRequest = zodLikeRequest.parse({...req.body, userName: req.user.userName})
        if (likeRequest.isLike){
            const success = postService.likePost(likeRequest);
        }
        if (!likeRequest.isLike){
            const success = postService.unlikePost(likeRequest);
        }
        if (!success){
            res.status(500).send();
        }
        res.status(200).send();
        
    } catch(err){
        if (err instanceof HttpError) {
            res.status(err.statusCode).send(err);
            return;
        }
        console.error(err);
        res.status(500).send();

    }


})