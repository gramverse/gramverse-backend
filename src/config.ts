import mongoose from "mongoose";
import {TagRepository} from "./repository/tag.repository"
import {PostService} from "./services/post.service"
import {UserRepository} from "./repository/user.repository";
import {TokenRepository} from "./repository/token.repository";
import {UserService} from "./services/user.service";
import { TokenService } from "./services/reset.service";
import { EmailService } from "./utilities/nodemailer";
import {PostRepository} from "./repository/post.repository";
import { FollowRepository } from "./repository/follow.repository";
import { LikesRepository } from "./repository/likes.repository";
import { CommentslikeRepository } from "./repository/commentslike.repository";
import { CommentsRepository } from "./repository/comments.repository";
import { BookmarksRepository } from "./repository/bookmarks.repository";
import { BlockRepository } from "./repository/block.repository";
import {NotificationRepository} from "./repository/notification.repository";
import {EventRepository} from "./repository/event.repository";
import {NotificationService} from "./services/notification.service";


const followRepository = new FollowRepository(mongoose);
const tagRepository = new TagRepository(mongoose);
const postRepository = new PostRepository(mongoose);
const likesRepository = new LikesRepository(mongoose);
const commentslikeRepository = new CommentslikeRepository(mongoose);
const commentsRepository = new CommentsRepository(mongoose);
const bookmarksRepository = new BookmarksRepository(mongoose);
const userRepository = new UserRepository(mongoose);
const bookmarkRepository = new BookmarksRepository(mongoose);
const tokenRepository = new TokenRepository(mongoose);
const emailService = new EmailService();
const blockRepository = new BlockRepository(mongoose);
const notificationRepository = new NotificationRepository(mongoose);
const eventRepository = new EventRepository(mongoose);

export const notificationService = new NotificationService(notificationRepository, eventRepository, postRepository, commentsRepository, followRepository, userRepository);
export const postService = new PostService(postRepository, userRepository, tagRepository, commentsRepository, bookmarksRepository, likesRepository, commentslikeRepository, bookmarkRepository, followRepository,notificationRepository);
export const userService = new UserService(postService, userRepository, postRepository, tokenRepository, followRepository,blockRepository);
export const tokenService = new TokenService(tokenRepository,userRepository,userService, emailService);

export const jwtSecret = process.env.JWT_SECRET||"FDaI22";