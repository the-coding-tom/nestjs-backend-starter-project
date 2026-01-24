import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRepository } from '../../repositories/session.repository';
import { VerificationRequestRepository } from '../../repositories/verification-request.repository';
import { Constants } from '../../common/enums/generic.enum';

/**
 * Cleanup Expired Sessions Cron
 * 
 * Runs periodically to clean up expired sessions and verification requests.
 * This helps keep the database clean and improves performance.
 */
@Injectable()
export class CleanupExpiredSessionsCron {
  private readonly logger = new Logger(CleanupExpiredSessionsCron.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly verificationRequestRepository: VerificationRequestRepository,
  ) {}

  // Run every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Starting cleanup of expired sessions and verification requests');

    try {
      // Clean up expired sessions
      const deletedSessions = await this.sessionRepository.deleteExpiredSessions();
      this.logger.log(`Deleted ${deletedSessions} expired sessions`);

      // Clean up expired verification requests
      const deletedVerifications =
        await this.verificationRequestRepository.deleteExpired();
      this.logger.log(`Deleted ${deletedVerifications} expired verification requests`);

      this.logger.log(Constants.successCronMessage);
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error.message}`, error.stack);
    }
  }
}

