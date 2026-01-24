import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { EmailNotificationProcessor } from './processors/email-notification.processor';
import { PushNotificationProcessor } from './processors/push-notification.processor';
import { WhatsAppNotificationProcessor } from './processors/whatsapp-notification.processor';
import { StripeCheckoutProcessor } from './processors/stripe-checkout.processor';
import { QueueProducersModule } from './queue-producers.module';
import { EmailModule } from '../common/services/email/email.module';
import { PushModule } from '../common/services/push/push.module';
import { WhatsAppModule } from '../common/services/whatsapp/whatsapp.module';

/**
 * Queue Processors Module
 * 
 * Registers all queue processors that handle background jobs.
 * Add new processors here as you create them.
 * 
 * Usage:
 * 1. Create processor class in processors/ folder
 * 2. Register processor here
 * 3. Import required modules (RepositoriesModule, etc.)
 */
@Module({
  imports: [
    QueueProducersModule, // Import queues from producers module
    RepositoriesModule, // Processors need access to repositories
    EmailModule, // Email notification processor needs email service
    PushModule, // Push notification processor needs push service
    WhatsAppModule, // WhatsApp notification processor needs whatsapp service
  ],
  providers: [
    // Queue processors
    EmailNotificationProcessor,
    PushNotificationProcessor,
    WhatsAppNotificationProcessor,
    StripeCheckoutProcessor,
  ],
  exports: [
    EmailNotificationProcessor,
    PushNotificationProcessor,
    WhatsAppNotificationProcessor,
    StripeCheckoutProcessor,
  ],
})
export class QueueProcessorsModule {}

