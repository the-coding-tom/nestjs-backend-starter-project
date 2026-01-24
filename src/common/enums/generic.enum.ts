export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export enum UserType {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export enum OAuthProvider {
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
}

export enum VerificationRequestType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum Language {
  EN = 'en',
  FR = 'fr',
}

export enum AuthType {
  JWT = 'jwt',
  API_KEY = 'api_key',
}

export enum NotificationType {
  SUBSCRIPTION = 'subscription',
  WORKSPACE_INVITATION = 'workspace_invitation',
}

export enum NotificationStatus {
  EXPIRING = 'expiring',
  EXPIRED = 'expired',
}

export enum NotificationAction {
  ACCEPTED = 'accepted',
}

export enum WebhookSource {
  STRIPE = 'stripe',
  BREVO = 'brevo',
  WHATSAPP = 'whatsapp',
}

export enum StripeEventType {
  CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed',
  CUSTOMER_SUBSCRIPTION_CREATED = 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  INVOICE_PAYMENT_SUCCEEDED = 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
}

export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'validationError',
  EMAIL_EXISTS = 'emailExists',
  INVALID_CREDENTIALS = 'invalidCredentials',
  EMAIL_NOT_VERIFIED = 'emailNotVerified',
  ACCOUNT_INACTIVE = 'accountInactive',
  PASSWORD_TOO_WEAK = 'passwordTooWeak',
  
  // Token errors
  MISSING_CODE = 'missingCode',
  INVALID_REFRESH_TOKEN = 'invalidRefreshToken',
  EXPIRED_REFRESH_TOKEN = 'expiredRefreshToken',
  INVALID_TOKEN = 'invalidToken',
  EXPIRED_TOKEN = 'expiredToken',
  INVALID_TOKEN_TYPE = 'invalidTokenType',
  
  // MFA errors
  TOTP_NOT_ENABLED = 'totpNotEnabled',
  TOTP_ALREADY_ENABLED = 'totpAlreadyEnabled',
  TOTP_SETUP_NOT_FOUND = 'totpSetupNotFound',
  INVALID_TOTP_CODE = 'invalidTotpCode',
  INVALID_BACKUP_CODE = 'invalidBackupCode',
  BACKUP_CODE_NOT_FOUND = 'backupCodeNotFound',
  MFA_SESSION_NOT_FOUND = 'mfaSessionNotFound',
  MFA_SESSION_EXPIRED = 'mfaSessionExpired',
  
  // Resource errors
  USER_NOT_FOUND = 'userNotFound',
  SESSION_NOT_FOUND = 'sessionNotFound',
  VERIFICATION_TOKEN_NOT_FOUND = 'verificationTokenNotFound',
  VERIFICATION_TOKEN_EXPIRED = 'verificationTokenExpired',
  EMAIL_ALREADY_VERIFIED = 'emailAlreadyVerified',
  RESOURCE_NOT_FOUND = 'resourceNotFound',
  ACCESS_DENIED = 'accessDenied',

  // Device errors
  DEVICE_NOT_FOUND = 'deviceNotFound',
  DEVICE_ACCESS_DENIED = 'deviceAccessDenied',
  
  // Subscription errors
  PLAN_NOT_FOUND = 'planNotFound',
  SUBSCRIPTION_NOT_FOUND = 'subscriptionNotFound',
  SUBSCRIPTION_ALREADY_CANCELED = 'subscriptionAlreadyCanceled',
  PRICE_NOT_AVAILABLE = 'priceNotAvailable',

  // Webhook errors
  DUPLICATE_WEBHOOK_EVENT = 'duplicateWebhookEvent',

  // Workspace errors
  WORKSPACE_NOT_FOUND = 'workspaceNotFound',
  WORKSPACE_MEMBER_NOT_FOUND = 'workspaceMemberNotFound',
  SEAT_LIMIT_EXCEEDED = 'seatLimitExceeded',
  WORKSPACE_ACCESS_DENIED = 'workspaceAccessDenied',
  WORKSPACE_LIMIT_EXCEEDED = 'workspaceLimitExceeded',
  
  // Authentication errors
  AUTHENTICATION_ERROR = 'authenticationError',
  AUTHENTICATION_REQUIRED = 'authenticationRequired',
  OAUTH_ERROR = 'oauthError',
  
  // Server errors
  SERVER_ERROR = 'serverError',
}

/**
 * @deprecated Use i18n translation keys instead of Constants for user-facing messages.
 * This is kept only for internal logging purposes (e.g., cron jobs).
 */
export const Constants = {
  // Cron messages (internal logging only)
  successCronMessage: 'Cron job executed successfully',
};

