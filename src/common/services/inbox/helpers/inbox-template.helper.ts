import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../../../../config/config';

const templateCache = new Map<string, any>();

/**
 * Load inbox templates from file system
 */
function loadInboxTemplates(language: string): any {
    const cacheKey = language;

    if (templateCache.has(cacheKey)) {
        return templateCache.get(cacheKey);
    }

    const templatePath = config.isProduction
        ? join(process.cwd(), 'dist/common/services/inbox/templates', language, 'templates.json')
        : join(process.cwd(), 'src/common/services/inbox/templates', language, 'templates.json');

    try {
        const templates = JSON.parse(readFileSync(templatePath, 'utf-8'));
        templateCache.set(cacheKey, templates);
        return templates;
    } catch (error) {
        console.error(`Error loading inbox templates for language: ${language}`, error);
        if (language !== config.defaultLanguage) {
            return loadInboxTemplates(config.defaultLanguage);
        }
        throw new Error(`Inbox templates not found for language: ${language}`);
    }
}

/**
 * Render inbox notification template
 */
export function renderInboxTemplate(
    templateName: string,
    language: string,
    variables: Record<string, any>,
): { title: string; body: string } {
    const templates = loadInboxTemplates(language);
    const template = templates[templateName];

    if (!template) {
        throw new Error(`Inbox template not found: ${templateName}`);
    }

    const title = Handlebars.compile(template.title)(variables);
    const body = Handlebars.compile(template.body)(variables);

    return { title, body };
}

/**
 * Clear template cache
 */
export function clearInboxTemplateCache(): void {
    templateCache.clear();
}
