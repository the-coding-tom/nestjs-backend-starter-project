import { Injectable, Logger } from '@nestjs/common';
import { NotificationCategory } from '@prisma/client';
import { NotificationRepository } from '../../../repositories/notification.repository';
import { renderInboxTemplate } from './helpers/inbox-template.helper';

/**
 * Inbox Notification Service
 *
 * Creates and manages in-app notifications (inbox notifications).
 * These appear in the user's notification center.
 *
 * Usage:
 * - Call create() to render and save an inbox notification
 */
@Injectable()
export class InboxService {
    private readonly logger = new Logger(InboxService.name);

    constructor(
        private readonly notificationRepository: NotificationRepository,
    ) {}

    /**
     * Create an inbox notification (renders template and saves to database)
     *
     * @param userId - User ID to create notification for
     * @param template - Template name (e.g., 'workspace-invitation')
     * @param language - Language code (e.g., 'en', 'fr')
     * @param variables - Template variables
     * @param category - Notification category (default: USER)
     * @returns Created notification
     */
    async create(
        userId: number,
        template: string,
        language: string,
        variables: Record<string, any>,
        category: NotificationCategory = NotificationCategory.USER,
    ): Promise<any> {
        try {
            // Render notification content
            const { title, body } = renderInboxTemplate(template, language, variables);

            // Create notification in database
            return await this.notificationRepository.create({
                userId,
                category,
                title,
                body,
                type: template,
                payload: variables,
            });
        } catch (error) {
            this.logger.error(`Error creating inbox notification: ${template}`, error);
            throw error;
        }
    }
}
