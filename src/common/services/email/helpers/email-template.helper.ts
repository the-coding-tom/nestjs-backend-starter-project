import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../../../../config/config';

/**
 * Email Template Helper
 * 
 * Loads and renders email templates from the file system using Handlebars.
 * Templates are organized by language in separate HTML files.
 * 
 * Benefits of Handlebars:
 * - Automatic HTML escaping for security
 * - Support for conditionals, loops, and helpers
 * - Partials for reusable template components
 * - More robust variable replacement
 */

const templateCache = new Map<string, HandlebarsTemplateDelegate>();
const rawTemplateCache = new Map<string, string>();

/**
 * Register Handlebars helpers for email templates
 */
function registerHandlebarsHelpers(): void {
  // Helper to format dates
  Handlebars.registerHelper('formatDate', (date: Date | string, format?: string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '';
    
    if (format === 'short') {
      return d.toLocaleDateString();
    }
    return d.toLocaleString();
  });

  // Helper to uppercase text
  Handlebars.registerHelper('uppercase', (text: string) => {
    return typeof text === 'string' ? text.toUpperCase() : text;
  });

  // Helper to lowercase text
  Handlebars.registerHelper('lowercase', (text: string) => {
    return typeof text === 'string' ? text.toLowerCase() : text;
  });
}

// Register helpers once on module load
registerHandlebarsHelpers();

/**
 * Load email template from file system
 * 
 * @param templateName - Name of the template (e.g., 'verification', 'password-reset')
 * @param language - Language code (e.g., 'en', 'fr')
 * @returns Raw template content as string
 */
function loadRawTemplate(templateName: string, language: string): string {
  const cacheKey = `${language}:${templateName}`;

  // Return cached raw template if available
  if (rawTemplateCache.has(cacheKey)) {
    return rawTemplateCache.get(cacheKey)!;
  }

  // Determine template path
  const templatePath = config.isProduction
    ? join(process.cwd(), 'dist/common/services/email/templates', language, `${templateName}.html`)
    : join(process.cwd(), 'src/common/services/email/templates', language, `${templateName}.html`);

  try {
    const template = readFileSync(templatePath, 'utf-8');
    rawTemplateCache.set(cacheKey, template);
    return template;
  } catch (error) {
    console.error(`Error loading template: ${templateName} for language: ${language}`, error);
    console.error(`Template path: ${templatePath}`);
    // Fallback to default language if template not found
    if (language !== config.defaultLanguage) {
      console.error(`Fallback to default language: ${config.defaultLanguage}`);
      return loadRawTemplate(templateName, config.defaultLanguage);
    }
    throw new Error(`Template not found: ${templateName} for language: ${language}`);
  }
}

/**
 * Get compiled Handlebars template (with caching)
 * 
 * @param templateName - Name of the template (e.g., 'verification', 'password-reset')
 * @param language - Language code (e.g., 'en', 'fr')
 * @returns Compiled Handlebars template function
 */
function getCompiledTemplate(templateName: string, language: string): HandlebarsTemplateDelegate {
  const cacheKey = `${language}:${templateName}`;

  // Return cached compiled template if available
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!;
  }

  // Load raw template
  const rawTemplate = loadRawTemplate(templateName, language);

  // Compile template with Handlebars
  const compiled = Handlebars.compile(rawTemplate);
  
  // Cache compiled template
  templateCache.set(cacheKey, compiled);
  
  return compiled;
}

/**
 * Render email template with variables using Handlebars
 * 
 * @param templateName - Name of the template (e.g., 'verification', 'password-reset')
 * @param language - Language code (e.g., 'en', 'fr')
 * @param variables - Variables to replace in template (e.g., { subject: '...', title: '...' })
 * @returns Rendered HTML string
 */
export function renderEmailTemplate(
  templateName: string,
  language: string,
  variables: Record<string, any>,
): string {
  const compiledTemplate = getCompiledTemplate(templateName, language);
  
  // Render template with variables (Handlebars automatically escapes HTML)
  return compiledTemplate(variables);
}

/**
 * Clear template cache (useful for development/testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  rawTemplateCache.clear();
}
