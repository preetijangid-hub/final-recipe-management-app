export type NotificationType = 'review' | 'save';

export interface NotificationActor {
  _id: string;
  name: string;
}

export interface NotificationRecipe {
  _id: string;
  title: string;
}

export interface AppNotification {
  _id: string;
  type: NotificationType;
  read: boolean;
  message: string;
  createdAt: string;
  actor: NotificationActor;
  recipe: NotificationRecipe;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkReadResponse {
  message: string;
  notification: AppNotification;
  unreadCount: number;
}

export interface MarkAllReadResponse {
  message: string;
  modifiedCount: number;
  unreadCount: number;
}
