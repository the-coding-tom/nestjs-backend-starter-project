import { convert } from 'html-to-text';

/**
 * Convert HTML to plain text for email clients that don't support HTML
 */
export function convertHtmlToText(html: string): string {
  return convert(html, {
    wordwrap: 130,
    selectors: [
      { selector: 'a', format: 'anchor' },
      { selector: 'img', format: 'skip' },
    ],
  });
}
