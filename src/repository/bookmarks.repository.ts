import { Model } from "mongoose";
import { bookmarkSchema } from "../models/bookmark/bookmark-schema";
import { IBookmark, Bookmark } from "../models/bookmark/bookmark";
import { BookmarkDto } from "../models/bookmark/bookmark-request";

export  class BookmarksRepository {
    private bookmarks: Model<IBookmark>;
    constructor(private datahandler: typeof import ("mongoose")) {
        this.bookmarks = datahandler.model<IBookmark>("bookmarks", bookmarkSchema);
    }
    add = async (bookmarkDto: BookmarkDto) => {
        const createdBookmark = (await this.bookmarks.create(bookmarkDto));
        if (!createdBookmark) {
            return undefined;
        }
        const newBookmark: Bookmark = createdBookmark;
        return newBookmark;
    }

    getCountByPostId = async (postId: string) => {
         return await this.bookmarks.countDocuments({postId});
    }

    bookmarkExists = async (userName: string, postId: string) => {
        const bookmark = await this.bookmarks.findOne({userName, postId, isDeleted: false});
        return !!bookmark;
    }

    deleteBookmark = async (userName: string, postId: string) => {
        const updateResult = await this.bookmarks.updateOne({userName, postId}, {isDeleted: true});
        if (!updateResult.acknowledged){
            return false;
        }
        return true;
    }

    undeleteBookmark = async (userName: string, postId: string) => {
        const updateResult = await this.bookmarks.updateOne({userName, postId}, {isDeleted: false});
        if (!updateResult.acknowledged){
            return false;
        }
        return true;
    }

    getBookmark = async (userName: string, postId: string) => {
        const bookmark: Bookmark|undefined = await this.bookmarks.findOne({userName, postId})||undefined;
        return bookmark;
    }
}