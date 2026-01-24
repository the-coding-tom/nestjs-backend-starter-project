import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../../../../config/config';
import * as Handlebars from 'handlebars';

/**
 * Push Notification Template Helper
 * 
 * Loads and renders push notification templates from JSON files.
 * Templates are organized by language and contain title/body pairs.
 * 
 * Push notifications are simpler than emails - just title and body text.
 * We use Handlebars for variable replacement in the templates.
 */

interface PushTemplate {
  title: string;
  body: string;
}

interface PushTemplates {
  [key: string]: PushTemplate;
}

const templateCache = new Map<string, PushTemplates>();

/**
 * Register Handlebars helpers for push notification templates
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
 * Load push notification templates from file system
 * 
 * @param language - Language code (e.g., 'en', 'fr')
 * @returns Templates object with all notification types
 */
function loadTemplates(language: string): PushTemplates {
  // Return cached templates if available
  if (templateCache.has(language)) {
    return templateCache.get(language)!;
  }

  // Determine template path
  const templatePath = config.isProduction
    ? join(process.cwd(), 'dist/common/services/push/templates', language, 'templates.json')
    : join(process.cwd(), 'src/common/services/push/templates', language, 'templates.json');

  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const templates = JSON.parse(templateContent) as PushTemplates;
    templateCache.set(language, templates);
    return templates;
  } catch (error) {
    console.error(`Error loading push templates for language: ${language}`, error);
    console.error(`Template path: ${templatePath}`);
    // Fallback to default language if template not found
    if (language !== config.defaultLanguage) {
      console.error(`Fallback to default language: ${config.defaultLanguage}`);
      return loadTemplates(config.defaultLanguage);
    }
    throw new Error(`Push notification templates not found for language: ${language}`);
  }
}

/**
 * Render push notification template with variables
 * 
 * @param templateType - Type of notification (e.g., 'member_joined', 'subscription_expiring')
 * @param language - Language code (e.g., 'en', 'fr')
 * @param variables - Variables to replace in template (e.g., { monitorName: '...', workspaceName: '...' })
 * @returns Rendered title and body
 */
export function renderPushTemplate(
  templateType: string,
  language: string,
  variables: Record<string, any> = {},
): { title: string; body: string } {
  const templates = loadTemplates(language);

  if (!templates[templateType]) {
    // Fallback to default language if template type not found
    if (language !== config.defaultLanguage) {
      return renderPushTemplate(templateType, config.defaultLanguage, variables);
    }
    throw new Error(`Push notification template type not found: ${templateType} for language: ${language}`);
  }

  const template = templates[templateType];

  // Compile and render title with Handlebars
  const titleTemplate = Handlebars.compile(template.title);
  const renderedTitle = titleTemplate(variables);

  // Compile and render body with Handlebars
  const bodyTemplate = Handlebars.compile(template.body);
  const renderedBody = bodyTemplate(variables);

  return {
    title: renderedTitle,
    body: renderedBody,
  };
}

/**
 * Clear template cache (useful for development/testing)
 */
export function clearPushTemplateCache(): void {
  templateCache.clear();
}
