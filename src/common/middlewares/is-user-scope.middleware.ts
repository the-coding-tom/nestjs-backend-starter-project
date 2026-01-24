import {
  HttpStatus,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ApiRequest } from '../types/request.types';
import { AuthType, ErrorCode } from '../enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';

/**
 * User scope middleware
 * Ensures request is authenticated with JWT (not API key)
 * Use this for routes that should only be accessible via user sessions
 */
@Injectable()
export class IsUserScopeMiddleware implements NestMiddleware {
  constructor(private readonly i18n: I18nService) {}

  use(req: ApiRequest, res: Response, next: NextFunction) {
    const lang = req.language;

    if (!req.userId || !req.user) {
      const message = translate(this.i18n, 'common.authenticationRequired', lang);
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message,
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
      });
    }

    // Ensure it's JWT authentication (not API key)
    if (req.authType !== AuthType.JWT) {
      const message = translate(this.i18n, 'common.authenticationRequired', lang);
      throw new UnauthorizedException(message);
    }

    next();
  }
}

