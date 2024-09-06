import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { jwtSecret, userService } from "../config";
import { ErrorCode } from "../errors/error-codes";
import { HttpError } from "../errors/http-error";
import {AuthorizedUser} from "../models/profile/authorized-user";
import { LoginRequest } from "../models/login/login-request";
import { LoginResponse, User, UserToValidate } from "../models/login/login-response";
import {EditProfileDto} from "../models/profile/edit-profile-dto";
import { RegisterRequest } from "../models/register/register-request";
import {UserRepository} from "../repository/user.repository";
import {TokenRepository} from "../repository/token.repository";
import {Token} from "../models/reset-password/token";
import { FollowRepository } from "../repository/follow.repository";
import { PostRepository } from "../repository/post.repository";
import {MyProfileDto} from "../models/profile/my-profile-dto";
import {ProfileDto} from "../models/profile/profile-dto";
import { FollowRequest } from "../models/follow/follow-request";
import { Follow } from "../models/follow/follow";
import { FollowingersRequest } from '../models/follow/followingers-request';
import {Followinger} from "../models/follow/followinger";
import { FollowRequestState } from "../models/follow/follow-request-state";
import {PostService} from "./post.service";
import e from "express";
import { BlockRequest } from "../models/block/block-request";
import {BlockRepository} from "../repository/block.repository"
import { RemoveFollowRequest } from "../models/follow/remove-follow-request";

export interface IUserService {
    signup: (registerRequest: RegisterRequest) => Promise<LoginResponse|undefined>;
    checkEmailExistance: (email: string) => Promise<boolean>;
    checkUserNameExistance: (userName: string) => Promise<boolean>;
    validateInfo: (user: Partial<UserToValidate>, isForSignup: boolean) => void;
    login: (loginRequest: LoginRequest) => Promise<LoginResponse|undefined>;
    getUser: (userNameOrPassword: string) => Promise<User|undefined>;
    // ... reset password functions
    // editProfile: (profile: Profile) => Promise<Profile>;
}

export class UserService implements IUserService {
    constructor(private postService: PostService, private userRepository: UserRepository, private postRepository: PostRepository, private tokenRepository: TokenRepository, private followRepository: FollowRepository,private blockrepository:BlockRepository) {}

    getUser = async (userNameOrEmail : string) =>{
        const isEmail = userNameOrEmail.includes("@");
        let user ;
        if (isEmail) {
            user = await this.userRepository.getUserByEmail(userNameOrEmail);
        } else {
            user = await this.userRepository.getUserByUserName(userNameOrEmail);
        }
        return user;
    } 
    
    login = async (loginRequest : LoginRequest) => {
        const user = await this.getUser(loginRequest.userName);
        
        if (!user){
            return undefined;
        }
        const passwordMatch = await bcrypt.compare(loginRequest.password, user.passwordHash);
        if (!passwordMatch){
            return undefined;
        }
        const tokenPayload: AuthorizedUser = {
            _id: user._id||"",
            userName: user.userName,
            email: user.email
        };
        let token : string;
        let expireTime: number;
        if (loginRequest.rememberMe) {
            token = await jwt.sign({ data: tokenPayload }, jwtSecret, { expiresIn: "168h" });
            expireTime = 7*24*3600*1000;
        } else {
            token = await jwt.sign({ data: tokenPayload }, jwtSecret, { expiresIn: "72h"});
            expireTime = 3*24*3600*1000;
        }
        
        const loginResponse : LoginResponse = {user, token, expireTime};
        return loginResponse;
    }

    validateInfo = (user: Partial<UserToValidate>, hasNewPassword: boolean) => {
        const userNamePattern = /^(?!.{33})[a-zA-Z0-9_.]{6,}$/;
        if (!user.userName || !userNamePattern.test(user.userName)) {
            throw new HttpError(400, ErrorCode.INVALID_USERNAME, "Invalid username");
        }
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!user.email || !emailPattern.test(user.email)) {
            throw new HttpError(400, ErrorCode.INVALID_EMAIL, "Invalid email");
        }
        if (hasNewPassword && (!user.password || user.password.length < 8 || user.password.length > 32)) {
            throw new HttpError(400, ErrorCode.INVALID_PASSWORD, "Invalid password");
        }
    }

    checkEmailExistance = async (email: string) => {
        return await this.userRepository.checkEmailExistance(email);
    }

    checkUserNameExistance = async (userName: string) => {
        return await this.userRepository.checkUserNameExistance(userName);
    }

    signup = async (registerRequest: RegisterRequest) => {
        const userToValidate: Partial<UserToValidate> = {
            userName: registerRequest.userName,
            email: registerRequest.email,
            password: registerRequest.password
        };
        this.validateInfo(userToValidate, true);
        const emailExists = await this.checkEmailExistance(registerRequest.email);
        if (emailExists) {
            throw new HttpError(400, ErrorCode.EMAIL_EXISTS, "Email Exists");
        }
        const userNameExists = await this.checkUserNameExistance(registerRequest.userName);
        if (userNameExists) {
            throw new HttpError(400, ErrorCode.USERNAME_EXISTS, "Username exists");
        }
        const passwordHash = await bcrypt.hash(registerRequest.password, 10);
        const newUser: User = {
            userName: registerRequest.userName,
            firstName: "",
            lastName: "",
            email: registerRequest.email,
            passwordHash,
            profileImage: "",
            isPrivate: false,
            bio: "",
        }
        const createdUser = await this.userRepository.add(newUser);
        if (!createdUser) {
            throw new HttpError(400, ErrorCode.UNSUCCESSFUL_SIGNUP, "Signup unsuccessful due to an unknown reason");
        }
        const loginRequest: LoginRequest = {
            userName: registerRequest.userName,
            password: registerRequest.password,
            rememberMe: false
        }
        const loginResponse = await this.login(loginRequest);
        return loginResponse;
    }

    getMyProfile = async (userName: string) => {
        const user = await this.getUser(userName);
        if (!user) {
            return undefined;
        }
        const {email, firstName, lastName, profileImage, isPrivate, bio} = user;
        const followerCount = await this.followRepository.getFollowerCount(user.userName);
        const followingCount = await this.followRepository.getFollowingCount(user.userName);
        const postCount = await this.postRepository.getPostCount(user.userName, false);
        const profile: MyProfileDto = {
            userName: user.userName,
            email,
            firstName,
            lastName,
            profileImage,
            isPrivate,
            bio,
            followerCount,
            followingCount,
            postCount
        };
        return profile;
    }

    getProfile = async (userName: string, myUserName: string) => {
        const user = await this.getUser(userName);
        if (!user) {
            return undefined;
        }
        const {email, firstName, lastName, profileImage, isPrivate, bio} = user;
        const {followRequestState, isBlocked, isCloseFriend} = await this.followRepository.getFollow(myUserName, userName)|| {
            followRequestState: FollowRequestState.NONE, isBlocked: false, isCloseFriend: false
        };
        const {isBlocked: hasBlockedUs} = await this.followRepository.getFollow(userName, myUserName)|| {
            isBlocked: false
        };
        const followerCount = await this.followRepository.getFollowerCount(user.userName);
        const followingCount = await this.followRepository.getFollowingCount(user.userName);
        const postCount = await this.postRepository.getPostCount(user.userName, false);
        const profile: ProfileDto = {
            userName: user.userName,
            firstName,
            lastName,
            profileImage,
            isPrivate,
            bio,
            followRequestState,
            isBlocked,
            isCloseFriend,
            hasBlockedUs,
            followerCount,
            followingCount,
            postCount
        };
        return profile;
    }

    editProfile = async (profileDto: EditProfileDto, user: AuthorizedUser) => {
        const passwordIsUpdated = !!profileDto.password;
        this.validateInfo(profileDto, passwordIsUpdated);
        if (profileDto.userName != user.userName) {
            if (await this.checkUserNameExistance(profileDto.userName)) {
                throw new HttpError(400, ErrorCode.USERNAME_EXISTS, "Username exists");
            }
        }
        if (profileDto.email != user.email) {
            if (await this.checkEmailExistance(profileDto.email)) {
                throw new HttpError(400, ErrorCode.EMAIL_EXISTS, "Email exists");
            }
        }
        const oldUser = await this.userRepository.getUserByEmail(user.email);
        if (!oldUser) {
            throw new HttpError(500, ErrorCode.UNKNOWN_ERROR, "An error occurred reading database.");
        }
        if (oldUser.isPrivate && !profileDto.isPrivate) {
            this.followRepository.acceptPendingRequests(profileDto.userName);
        }
        const passwordHash = passwordIsUpdated ? await bcrypt.hash(profileDto.password, 10) : oldUser.passwordHash;
        const userToBeUpdated = {
            _id: user._id,
            ... profileDto,
            passwordHash,
        };
        const updatedUser = await this.userRepository.update(userToBeUpdated);
        return updatedUser;
    }

    follow = async (followRequest: FollowRequest) => {
        const {followerUserName, followingUserName} = followRequest;
        const user = await this.getUser(followingUserName);
        if (!user) {
            throw new HttpError(404, ErrorCode.USER_NOT_FOUND, "User not found");
        }
        if (user.isPrivate) {
            return await this.sendFollowRequest(followRequest);
        }
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (existingFollow) {
            if (existingFollow.followRequestState == FollowRequestState.ACCEPTED) {
                return true;
            }
            return await this.followRepository.undeleteFollow(followerUserName, followingUserName);
        }
        const createdFollow = await this.followRepository.add(followRequest);
        return !!createdFollow;
    }

    sendFollowRequest = async (followRequest: FollowRequest) => {
        const {followerUserName, followingUserName} = followRequest;
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (existingFollow) {
            if (existingFollow.followRequestState == FollowRequestState.ACCEPTED
            || existingFollow.followRequestState == FollowRequestState.PENDING) {
                return true;
            }
            const success = await this.followRepository.setFollowAsPending(followerUserName, followingUserName);
            return success;
        }
        const createdFollow = await this.followRepository.add({...followRequest, followRequestState: FollowRequestState.PENDING});
        return !!createdFollow;
    }

    unfollow = async (followRequest: FollowRequest) => {
        const {followerUserName, followingUserName} = followRequest;
        const user = await this.getUser(followingUserName);
        if (!user) {
            throw new HttpError(404, ErrorCode.USER_NOT_FOUND, "User not found");
        }
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingFollow || existingFollow.isDeleted) {
            return true;
        }
        return await this.followRepository.deleteFollow(followerUserName, followingUserName);
    }

    acceptRequest = async (followerUserName: string, followingUserName: string) => {
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingFollow || existingFollow.followRequestState != FollowRequestState.PENDING) {
            throw new HttpError(400, ErrorCode.NO_SUCH_REQUEST, "You have no follow request from this username");
        }
        return await this.followRepository.undeleteFollow(followerUserName, followingUserName);
    }

    declineRequest = async (followerUserName: string, followingUserName: string) => {
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingFollow || existingFollow.followRequestState != FollowRequestState.PENDING) {
            throw new HttpError(400, ErrorCode.NO_SUCH_REQUEST, "You have no follow request from this username");
        }
        return await this.followRepository.declineFollow(followerUserName, followingUserName);
    }

    getFollowers = async (userName: string,myUserName: string, page: number,limit: number) => {
        await this.postService.checkUserAccess(myUserName, userName);
        const skip = (page -1) * limit
        const followers = await this.followRepository.getFollowers(userName,skip,limit);
        const followingers: Followinger[] = [];
        const totalCount = await this.followRepository.getFollowerCount(userName)
        const processes = followers.map(async f => {
            const user = await this.userRepository.getUserByUserName(f.followerUserName);
            if (!user) {
                throw new HttpError(500, ErrorCode.UNKNOWN_ERROR, "Database integrity error");
            }
            const followinger: Followinger = {
                userName: user.userName,
                profileImage: user.profileImage,
                followerCount: await this.followRepository.getFollowerCount(user.userName),
            };
            followingers.push(followinger);
        });
        await Promise.all(processes);
        return {followingers ,totalCount};
    }

    getFollowings = async (userName: string,myUserName: string, page: number,limit: number) => {
        await this.postService.checkUserAccess(myUserName, userName);
        const skip = (page -1) * limit
        const totalCount = await this.followRepository.getFollowingCount(userName)
        const followings = await this.followRepository.getFollowings(userName,skip,limit);
        const followingers: Followinger[] = [];
        for (const f of followings) {
            const user = await this.userRepository.getUserByUserName(f.followingUserName);
            if (!user) {
                throw new HttpError(500, ErrorCode.UNKNOWN_ERROR, "Database integrity error");
            }
            const followinger: Followinger = {
                userName: user.userName,
                profileImage: user.profileImage,
                followerCount: await this.followRepository.getFollowerCount(user.userName),
            };
            followingers.push(followinger);
        }
        return {followingers ,totalCount};
    }

    getCloseFriends = async (userName: string,page: number,limit: number) => {
        const skip = (page -1) * limit;
        const totalCount = await this.followRepository.getCloseFriendsCount(userName);
        const closeFriends = await this.followRepository.getCloseFriends(userName,skip, limit);
        const followingers: Followinger[] = [];
        for (const f of closeFriends) {
            const user = await this.userRepository.getUserByUserName(f.followingUserName);
            if (!user) {
                throw new HttpError(500, ErrorCode.UNKNOWN_ERROR, "Database integrity error");
            }
            const followinger: Followinger = {
                userName: user.userName,
                profileImage: user.profileImage,
                followerCount: await this.followRepository.getFollowerCount(user.userName),
            };
            followingers.push(followinger);
        }
        return {followingers, totalCount};
    }   

    addCloseFriend = async (followerUserName: string, followingUserName: string) => {
        const user = await this.getUser(followingUserName);
        if (!user) {
            throw new HttpError(404, ErrorCode.USER_NOT_FOUND, "User not found");
        }
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingFollow || existingFollow.followRequestState != FollowRequestState.ACCEPTED) {
            throw new HttpError(403, ErrorCode.USER_IS_NOT_FOLLOWED, "Close friend must be your following");
        }
        if (existingFollow.isCloseFriend) {
            return true;
        }
        return await this.followRepository.addCloseFriend(followerUserName, followingUserName);
    }

    removeCloseFriend = async (followerUserName: string, followingUserName: string) => {
        const user = await this.getUser(followingUserName);
        if (!user) {
            throw new HttpError(404, ErrorCode.USER_NOT_FOUND, "User not found");
        }
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingFollow || existingFollow.followRequestState != FollowRequestState.ACCEPTED) {
            throw new HttpError(403, ErrorCode.USER_IS_NOT_FOLLOWED, "Close friend must be your following");
        }
        if (!existingFollow.isCloseFriend) {
            return true;
        }
        return await this.followRepository.removeCloseFriend(followerUserName, followingUserName);
    }

    block = async(blockRequest: BlockRequest) => {
        const {followerUserName,followingUserName} = blockRequest
        const existingBlock = await this.followRepository.getFollow(followerUserName, followingUserName);
        const userExists = await userService.checkUserNameExistance(followingUserName)
        if (!userExists) {
            throw new HttpError(400, ErrorCode.USER_NOT_FOUND,"Blocking UserName not exists")
        }
        if (existingBlock) {
            if (existingBlock.isBlocked) {
                return true;
            }
            await this.followRepository.deleteFollow(followingUserName,followerUserName)
            return (await this.blockrepository.block(followerUserName, followingUserName));
        }
        return await this.blockrepository.blockNonFollowing(followerUserName,followingUserName)
    }
    unBlock = async(blockRequest: BlockRequest) => {
        const {followerUserName,followingUserName} = blockRequest
        const existingBlock = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingBlock) {
            return true;
        }
        return await this.blockrepository.unblock(followerUserName, followingUserName)
    }    
    getBlackList = async (userName: string,page: number,limit: number) => {
        const skip = (page -1) * limit;
        const totalCount = await this.blockrepository.getBlockListCount(userName);
        const blockList = await this.blockrepository.getBlockList(userName,skip, limit);
        const followingers: Followinger[] = [];
        for (const f of blockList) {
            const user = await this.userRepository.getUserByUserName(f.followingUserName);
            if (!user) {
                throw new HttpError(500, ErrorCode.UNKNOWN_ERROR, "Database integrity error");
            }
            const followinger: Followinger = {
                userName: user.userName,
                profileImage: user.profileImage,
                followerCount: await this.followRepository.getFollowerCount(user.userName),
            };
            followingers.push(followinger);
        }
        return {followingers, totalCount};
    }
    removeFollow = async (removeFollowRequest: RemoveFollowRequest) => {
        const {followerUserName, followingUserName} = removeFollowRequest;
        const user = await this.getUser(followerUserName)
        if (!user) {
            throw new HttpError(404, ErrorCode.USER_NOT_FOUND, "User not found");
        }
        const existingFollow = await this.followRepository.getFollow(followerUserName, followingUserName);
        if (!existingFollow || existingFollow.isDeleted) {
            return true;
        }
        return await this.followRepository.deleteFollow(followerUserName, followingUserName);
    }

    checkMentionAccess = async (myUserName: string, userName: string) => {
        if (userName == myUserName) {
            return false;
        }
        const mentionerFollow = await this.followRepository.getFollow(myUserName, userName);
        const mentionedFollow = await this.followRepository.getFollow(userName, myUserName);
        if (mentionerFollow && mentionerFollow.isBlocked) {
            return false;
        }
        if (mentionedFollow && mentionedFollow.isBlocked) {
            return false;
        }
        const mentionedUser = await this.userRepository.getUserByUserName(userName);
        if (!mentionedUser) {
            return false;
        }
        if (mentionedUser.isPrivate && (!mentionerFollow || mentionerFollow.followRequestState != FollowRequestState.ACCEPTED)) {
            return false;
        }
        return true;
    }
}
