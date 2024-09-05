import { Model } from "mongoose";
import { INotification } from "../models/notification/notification";
import { notificationSchema } from "../models/notification/notification-schema";
import { AddNotifRequest } from "../models/notification/add-notif-request";

export class NotificationRepository {
    private notifications: Model<INotification>;
    constructor(private dataHandler : typeof import ("mongoose")) {
        this.notifications = dataHandler.model<INotification>("notifications", notificationSchema);
    }

    getUserNotifications = async (userName: string, isMine: boolean, skip: number, limit: number) => {
        return (await this.notifications.find({userName, isMine})
        .skip(skip)
        .limit(limit)
        .sort({creationDate: -1}))
        .map(n => n.toObject());
    }

    getNotifCount = async (userName: string, isMine: boolean) => {
        return await this.notifications.countDocuments({userName, isMine});
    }

    getUnreadCount = async (userName: string) => {
        return await this.notifications.countDocuments({userName, seen: false});
    }
    
    add = async (addNotifRequest: AddNotifRequest ) =>{
        const createdEvent = await this.notifications.create(addNotifRequest);
        if (!createdEvent) {
            return undefined;
        }
        const newNotif: INotification = createdEvent;
        return newNotif;
    }
    deleteEvent = async (notificationId: string) => {
        const deleteResult = await this.notifications.deleteOne({_id : notificationId})
        return deleteResult.acknowledged;
    }
}