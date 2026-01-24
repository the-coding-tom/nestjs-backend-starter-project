import axios from 'axios';
import { config } from '../../../config/config';

interface BrevoEmailRequest {
  sender: {
    name: string;
    email: string;
  };
  to: Array<{
    email: string;
  }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: {
    email: string;
    name?: string;
  };
  headers?: Record<string, string>;
  tags?: string[];
}

interface BrevoEmailResponse {
  messageId: string;
}

/**
 * Send email via Brevo API
 * 
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content
 * @returns Promise with message ID
 * @throws Error if API call fails
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ messageId: string }> {
  if (!config.brevo.apiKey) {
    throw new Error('Brevo API key is not configured');
  }

  const requestBody: BrevoEmailRequest = {
    sender: {
      name: config.brevo.fromName,
      email: config.brevo.fromEmail,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
    replyTo: {
      email: config.brevo.fromEmail,
      name: config.brevo.fromName,
    },
    headers: {
      'X-Mailer': 'NestJS Backend Template',
      'X-Priority': '1',
      'List-Unsubscribe': `<mailto:${config.brevo.fromEmail}?subject=Unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: ['transactional'],
  };

  const response = await axios.post<BrevoEmailResponse>(
    'https://api.brevo.com/v3/smtp/email',
    requestBody,
    {
      headers: {
        'api-key': config.brevo.apiKey,
        'Content-Type': 'application/json',
      },
    },
  );

  return {
    messageId: response.data.messageId,
  };
}

/**
 * Verify Brevo webhook bearer token
 * Brevo sends the bearer token in the Authorization header
 *
 * @param receivedToken - Token from Authorization header
 * @param expectedToken - Expected token from config
 * @returns true if tokens match, false otherwise
 */
export function verifyBrevoWebhookToken(
  receivedToken: string | undefined,
  expectedToken: string,
): boolean {
  if (!receivedToken || !expectedToken) {
    return false;
  }

  // Remove "Bearer " prefix if present
  const token = receivedToken.startsWith('Bearer ')
    ? receivedToken.substring(7)
    : receivedToken;

  // Use constant-time comparison to prevent timing attacks
  const crypto = require('crypto');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken),
    );
  } catch {
    // Buffers are different lengths
    return false;
  }
}
