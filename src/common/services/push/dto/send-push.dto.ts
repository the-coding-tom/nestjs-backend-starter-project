/**
 * Send Push DTO
 *
 * Payload structure for push notifications sent via queue
 */
export interface SendPushPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

import { NotificationType, NotificationStatus, NotificationAction } from '../../../enums/generic.enum';

/**
 * Push Notification Data
 *
 * Structure of data payload sent to clients in push notifications
 */
export interface PushNotificationData {
  notificationId: string;
  type: NotificationType;
  status?: NotificationStatus;
  action?: NotificationAction;
  [key: string]: any; // Allow additional payload fields
}

/**
 * Subscription Expiring Notification Payload
 */
export interface SubscriptionExpiringNotificationPayload {
  expiryDate: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Subscription Expired Notification Payload
 */
export interface SubscriptionExpiredNotificationPayload {
  [key: string]: any; // Allow additional fields
}

/**
 * Workspace Invitation Accepted Notification Payload
 */
export interface WorkspaceInvitationAcceptedNotificationPayload {
  memberName: string;
  workspaceName: string;
  [key: string]: any; // Allow additional fields
}
