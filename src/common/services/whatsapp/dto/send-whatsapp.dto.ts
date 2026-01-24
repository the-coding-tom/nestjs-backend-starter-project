import { WhatsAppTemplatePayload } from './whatsapp-api.dto';

/**
 * Send WhatsApp DTO
 *
 * Payload structure for WhatsApp messages sent via queue
 */
export class SendWhatsAppPayload {
  phoneNumber: string;
  templateType: string;
  language: string;
  variables: Record<string, string | number>;
  trackingId?: string; // Optional tracking ID (returned in webhook statuses)
}

/**
 * Internal payload for queue processor (already built template)
 */
export class SendWhatsAppQueuePayload {
  phoneNumber: string;
  template: WhatsAppTemplatePayload;
  trackingId?: string;
}

/**
 * Verification Code Payload
 */
export class VerificationCodePayload {
  code: string;
  expiryMinutes: string | number;
}
