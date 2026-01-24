/**
 * Send Email DTO
 *
 * Payload structure for email notifications sent via queue
 */
export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Email Verification Notification Payload
 */
export interface EmailVerificationNotificationPayload {
  token: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Password Reset Notification Payload
 */
export interface PasswordResetNotificationPayload {
  token: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Welcome Email Notification Payload
 */
export interface WelcomeEmailNotificationPayload {
  [key: string]: any; // Allow additional fields
}

/**
 * Workspace Invitation Email Notification Payload
 */
export interface WorkspaceInvitationEmailNotificationPayload {
  workspaceName: string;
  token: string;
  inviterName?: string;
  [key: string]: any; // Allow additional fields
}
