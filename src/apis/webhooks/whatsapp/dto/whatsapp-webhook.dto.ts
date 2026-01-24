/**
 * WhatsApp Webhook Event DTOs
 * Based on official documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

/**
 * Message delivery status types
 */
export type WhatsAppMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

/**
 * WhatsApp error in status webhook
 */
export interface WhatsAppStatusError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
  };
}

/**
 * Message status object in webhook
 */
export interface WhatsAppStatus {
  id: string; // WAMID
  status: WhatsAppMessageStatus;
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: {
      type: 'business_initiated' | 'user_initiated' | 'referral_conversion';
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: WhatsAppStatusError[];
  biz_opaque_callback_data?: string; // Tracking ID we sent
}

/**
 * Webhook metadata
 */
export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

/**
 * Contact profile information
 */
export interface WhatsAppContactProfile {
  name: string;
}

/**
 * Contact object in webhook
 */
export interface WhatsAppContact {
  profile: WhatsAppContactProfile;
  wa_id: string;
}

/**
 * Text message content
 */
export interface WhatsAppTextMessage {
  body: string;
}

/**
 * Incoming message object (for future use - two-way messaging)
 */
export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'button' | 'reaction';
  text?: WhatsAppTextMessage;
  // Add other message type content as needed
}

/**
 * Value object containing the actual webhook data
 */
export interface WhatsAppWebhookValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppStatus[];
}

/**
 * Change object in webhook entry
 */
export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: 'messages';
}

/**
 * Entry object in webhook payload
 */
export interface WhatsAppWebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: WhatsAppWebhookChange[];
}

/**
 * Main webhook payload structure
 */
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppWebhookEntry[];
}

/**
 * Verification query parameters (GET request)
 */
export interface WhatsAppVerificationQuery {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

/**
 * Processed status event for internal use
 */
export interface ProcessedWhatsAppStatus {
  messageId: string;
  status: WhatsAppMessageStatus;
  timestamp: Date;
  recipientId: string;
  phoneNumberId: string;
  businessAccountId: string;
  trackingId?: string;
  errors?: WhatsAppStatusError[];
  isBillable?: boolean;
}
