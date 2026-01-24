import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { LogInfo } from './types/logger.types';

const { combine, splat, timestamp, printf } = format;

const enumerateErrorFormat = format((info) => {
  const logInfo = info as LogInfo;
  if (logInfo.message instanceof Error) {
    logInfo.message = {
      message: logInfo.message.message,
      stack: logInfo.message.stack,
      ...logInfo.message,
    };
  }

  if (info instanceof Error) {
    return {
      stack: info.stack,
      ...info,
    };
  }

  return info;
});

const logger: WinstonLogger = createLogger({
  level: 'debug',
  format: combine(
    enumerateErrorFormat(),
    splat(),
    timestamp(),
    printf(
      ({ level, message, timestamp: ts, stack }) =>
        `${ts} ${level} : ${stack ? JSON.stringify(stack) : message}`,
    ),
  ),
  transports: [new transports.Console({})],
});

/**
 * Logger Service
 *
 * Static-only logger service. Use static methods directly:
 * - LoggerService.error('message')
 * - LoggerService.info('message')
 * - LoggerService.warn('message')
 * - LoggerService.debug('message')
 */
export class LoggerService {
  static error(message: string): void {
    logger.error(message);
  }

  static info(message: string): void {
    logger.info(message);
  }

  static warn(message: string): void {
    logger.warn(message);
  }

  static debug(message: string): void {
    logger.debug(message);
  }
}
