import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRepository } from '../../repositories/session.repository';
import { VerificationRequestRepository } from '../../repositories/verification-request.repository';
import { Constants } from '../../common/enums/generic.enum';

/**
 * Removes expired sessions and verification requests so the database does not retain them indefinitely and auth state stays accurate.
 */
@Injectable()
export class CleanupExpiredSessionsCron {
  private readonly logger = new Logger(CleanupExpiredSessionsCron.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly verificationRequestRepository: VerificationRequestRepository,
  ) {}

  /**
   * Deletes expired sessions and verification requests so they are not kept in the DB.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Starting cleanup of expired sessions and verification requests');

    try {
      const deletedSessions = await this.sessionRepository.deleteExpiredSessions();
      this.logger.log(`Deleted ${deletedSessions} expired sessions`);

      const deletedVerifications =
        await this.verificationRequestRepository.deleteExpired();
      this.logger.log(`Deleted ${deletedVerifications} expired verification requests`);

      this.logger.log(Constants.successCronMessage);
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error.message}`, error.stack);
    }
  }
}

