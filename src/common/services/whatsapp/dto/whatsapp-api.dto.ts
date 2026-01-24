/**
 * WhatsApp Cloud API Types
 *
 * Based on Meta WhatsApp Cloud API v24.0 documentation.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

// Response types
export class WhatsAppContact {
  input: string;
  wa_id: string;
}

export class WhatsAppMessage {
  id: string; // WAMID - max 128 chars
  message_status?: 'accepted' | 'held_for_quality_assessment';
}

export class WhatsAppSendResponse {
  messaging_product: 'whatsapp';
  contacts: WhatsAppContact[];
  messages: WhatsAppMessage[];
}

// Template component types
export class WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    id?: string;
    link?: string;
  };
  document?: {
    id?: string;
    link?: string;
    filename?: string;
  };
  video?: {
    id?: string;
    link?: string;
  };
}

export class WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters?: WhatsAppTemplateParameter[];
}

export class WhatsAppTemplatePayload {
  name: string;
  language: {
    policy: 'deterministic';
    code: string;
  };
  components?: WhatsAppTemplateComponent[];
}

// Template mapping types (for internal template → Meta template mapping)
export class WhatsAppTemplateMapping {
  metaTemplateName: string;
  languageCode: string;
  parameterOrder: string[];
  headerParameters?: string[];
  buttonParameters?: Array<{
    index: number;
    type: 'quick_reply' | 'url';
    parameters: string[];
  }>;
}

export class WhatsAppTemplateMappings {
  [key: string]: WhatsAppTemplateMapping;
}
