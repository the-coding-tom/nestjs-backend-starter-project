import { I18nService } from 'nestjs-i18n';

/**
 * Translate a message key to the specified language
 * @param i18nService - I18nService instance
 * @param key - Translation key (e.g., 'auth.login.success' or 'common.success')
 * @param lang - Language code (e.g., 'en', 'fr')
 * @param args - Optional arguments for interpolation
 * @returns Translated message
 */
export function translate(
  i18nService: I18nService,
  key: string,
  lang: string,
  args?: Record<string, any>,
): string {
  try {
    return i18nService.translate(key, {
      lang,
      args: args || {},
    });
  } catch (error) {
    // Fallback to key if translation fails
    return key;
  }
}
