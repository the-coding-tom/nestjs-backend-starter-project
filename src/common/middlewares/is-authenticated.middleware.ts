import {
  HttpStatus,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { LoggerService } from '../services/logger/logger.service';
import prisma from '../prisma';
import { ApiRequest } from '../types/request.types';
import { AuthType, ErrorCode, Language } from '../enums/generic.enum';
import { UserStatus } from '@prisma/client';
import { config } from '../../config/config';
import { translate } from '../../helpers/i18n.helper';

/**
 * Authentication middleware
 * Validates JWT tokens and injects user object into request
 */
@Injectable()
export class IsAuthenticatedMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,
  ) {}

  async use(req: ApiRequest, res: Response, next: NextFunction) {
    const lang = req.language;

    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const message = translate(this.i18n, 'common.authenticationRequired', lang);
        throw new UnauthorizedException(message);
      }

      const token = authHeader.substring(config.bearerTokenPrefixLength);

      // Verify JWT
      const decoded = this.jwtService.verify(token, {
        secret: config.authJWTSecret,
      });

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          localAuthAccount: true,
        },
      });

      if (!user) {
        const message = translate(this.i18n, 'validation.userNotFound', lang);
        throw new UnauthorizedException(message);
      }

      // Check user status
      if (user.status !== UserStatus.ACTIVE) {
        const message = translate(this.i18n, 'validation.accountInactive', lang);
        throw new UnauthorizedException(message);
      }

      // Inject auth data into request
      req.authType = AuthType.JWT;
      req.userId = user.id;
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name || '',
        status: user.status,
        photoUrl: user.photoUrl || undefined,
        language: user.language,
        localAuthAccount: user.localAuthAccount,
      };

      // Override request language with user preference if available
      if (user.language && config.i18n.supportedLanguages.includes(user.language.toLowerCase() as Language)) {
        req.language = user.language.toLowerCase();
      }

      next();
    } catch (error) {
      LoggerService.error(`Error during authentication: ${error.message}`);
      // Error message should already be translated (from UnauthorizedException or throwError)
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: error.message || 'Authentication failed',
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
      });
    }
  }
}

