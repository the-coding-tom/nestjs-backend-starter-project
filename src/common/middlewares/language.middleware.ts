import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { ApiRequest } from '../types/request.types';
import { Language } from '../enums/generic.enum';
import { config } from '../../config/config';

/**
 * Language resolution middleware
 * Resolves language from Accept-Language header and injects it into request
 * User preference (if authenticated) takes priority and is set by auth middleware
 */
@Injectable()
export class LanguageMiddleware implements NestMiddleware {
  /**
   * Parse Accept-Language header and return preferred language
   */
  private parseAcceptLanguage(acceptLanguage: string | undefined): string {
    if (!acceptLanguage) {
      return config.defaultLanguage;
    }

    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const parts = lang.trim().split(';');
        const code = parts[0].toLowerCase().substring(0, 2);
        const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
        return { code, quality };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const lang of languages) {
      if (config.i18n.supportedLanguages.includes(lang.code as Language)) {
        return lang.code;
      }
    }

    return config.defaultLanguage;
  }

  use(req: ApiRequest, _res: Response, next: NextFunction): void {
    // Only set if not already set (allows auth middleware to override with user preference)
    if (!req.language) {
      const acceptLanguage = req.headers['accept-language'];
      req.language = this.parseAcceptLanguage(acceptLanguage);
    }

    next();
  }
}

