import { NotificationCategory } from '@prisma/client';

export class CreateNotificationData {
  userId: number;
  category?: NotificationCategory;
  title: string;
  body: string;
  type: string;
  payload?: Record<string, any>;
}

export class UpdateNotificationData {
  readAt?: Date | null;
}

