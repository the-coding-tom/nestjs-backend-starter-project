import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';

/**
 * Register standard event listeners for a Bull queue
 * Provides consistent logging across all queue processors
 */
export function registerQueueEventListeners(
  queue: Queue,
  logger: Logger,
  queueName: string,
): void {
  logger.log(`[INIT] Setting up queue event listeners for ${queueName}`);

  queue.on('error', (error) => {
    logger.error(`[QUEUE ERROR] ${error.message}`, error.stack);
  });

  queue.on('waiting', (jobId: string | number) => {
    logger.debug(`[EVENT: WAITING] Job ${jobId} is waiting to be processed`);
  });

  queue.on('active', (job: Job) => {
    logger.log(`[EVENT: ACTIVE] Job ${job.id} is now active (being processed) - Data: ${JSON.stringify(job.data)}`);
  });

  queue.on('completed', (job: Job) => {
    logger.log(`[EVENT: COMPLETED] Job ${job.id} completed successfully`);
  });

  queue.on('failed', (job: Job | undefined, error: Error) => {
    logger.error(
      `[EVENT: FAILED] Job ${job?.id || 'unknown'} failed: ${error.message}`,
      error.stack,
    );
  });

  queue.on('stalled', (jobId: string | number) => {
    logger.warn(`[EVENT: STALLED] Job ${jobId} stalled (took too long to process)`);
  });

  queue.on('progress', (job: Job, progress: number | object) => {
    logger.debug(`[EVENT: PROGRESS] Job ${job.id} progress: ${JSON.stringify(progress)}`);
  });

  logger.log(`[INIT] Queue event listeners registered successfully for ${queueName}`);
}
