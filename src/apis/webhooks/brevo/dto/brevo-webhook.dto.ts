/**
 * Brevo Webhook Event DTOs
 * Based on official documentation: https://developers.brevo.com/docs/transactional-webhooks
 */

/**
 * All possible Brevo transactional email event types
 */
export type BrevoEventType =
  | 'request' // Email sent request
  | 'sent' // Email sent
  | 'delivered' // Email delivered to recipient
  | 'hard_bounce' // Hard bounce (permanent failure)
  | 'soft_bounce' // Soft bounce (temporary failure)
  | 'click' // Link clicked in email
  | 'opened' // Email opened
  | 'unique_opened' // First time email opened
  | 'proxy_open' // Proxy open event
  | 'unique_proxy_open' // Unique proxy open event
  | 'spam' // Marked as spam/complaint
  | 'deferred' // Delivery deferred
  | 'blocked' // Blocked by recipient server
  | 'error' // General error
  | 'invalid_email' // Invalid email address
  | 'unsubscribed'; // User unsubscribed

/**
 * Base class for all Brevo webhook events
 * Common fields present in all event types
 */
export class BrevoWebhookEventBase {
  event: BrevoEventType;
  email: string;
  id: number; // Webhook ID
  date: string; // Format: "YYYY-MM-DD HH:MM:SS"
  ts: number; // Timestamp in seconds
  'message-id': string; // Internal message identifier
  ts_event: number; // GMT timestamp
  subject?: string; // Email subject
  template_id?: number; // Template ID if used
  tags?: string[]; // Message tags
  tag?: string; // Single tag
  ts_epoch?: number; // Milliseconds UTC timestamp
  contact_id?: number; // Brevo contact identifier
  'X-Mailin-custom'?: string; // Custom header value
  sender_email?: string; // Sender email address
  sending_ip?: string; // Sending IP address
}

/**
 * Event with engagement tracking data (click, opened)
 */
export class BrevoEngagementEvent extends BrevoWebhookEventBase {
  event: 'click' | 'opened' | 'unique_opened' | 'proxy_open' | 'unique_proxy_open';
  link?: string; // Clicked URL (for click events)
  user_agent?: string; // Browser/client information
  device_used?: string; // Device type (DESKTOP, MOBILE, etc.)
  mirror_link?: string; // Email preview link
}

/**
 * Event with bounce/error data
 */
export class BrevoBounceEvent extends BrevoWebhookEventBase {
  event: 'hard_bounce' | 'soft_bounce' | 'deferred' | 'error' | 'blocked' | 'invalid_email';
  reason?: string; // Bounce/error reason
}

/**
 * Spam complaint event
 */
export class BrevoComplaintEvent extends BrevoWebhookEventBase {
  event: 'spam';
}

/**
 * Unsubscribe event
 */
export class BrevoUnsubscribeEvent extends BrevoWebhookEventBase {
  event: 'unsubscribed';
  sending_ip?: string; // Sending IP address
  user_agent?: string;
  device_used?: string;
}

/**
 * Delivered event
 */
export class BrevoDeliveredEvent extends BrevoWebhookEventBase {
  event: 'delivered';
}

/**
 * Sent event (request/sent)
 */
export class BrevoSentEvent extends BrevoWebhookEventBase {
  event: 'request' | 'sent';
}

/**
 * Union type of all possible Brevo webhook events
 */
export type BrevoWebhookEvent =
  | BrevoSentEvent
  | BrevoDeliveredEvent
  | BrevoBounceEvent
  | BrevoComplaintEvent
  | BrevoUnsubscribeEvent
  | BrevoEngagementEvent;

/**
 * DTO for Brevo webhook request body
 */
export class BrevoWebhookDto {
  event: string;
  email: string;
  id: number;
  date: string;
  ts: number;
  'message-id': string;
  ts_event: number;
  subject?: string;
  template_id?: number;
  tags?: string[];
  tag?: string;
  ts_epoch?: number;
  link?: string;
  user_agent?: string;
  device_used?: string;
  contact_id?: number;
  mirror_link?: string;
  reason?: string;
  sending_ip?: string;
  sender_email?: string;
  'X-Mailin-custom'?: string;
}
