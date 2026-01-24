import { Request } from 'express';
import { AuthType } from '../enums/generic.enum';

/**
 * API request type with optional auth data
 * Language is injected by LanguageMiddleware
 * Auth fields are injected by authentication middleware when present
 * Workspace context is injected by workspace context middleware when present
 */
export interface ApiRequest extends Request {
  language?: string; // Injected by LanguageMiddleware (from Accept-Language or user preference)
  userId?: number;
  authType?: AuthType;
  user?: {
    id: number;
    email: string;
    name: string;
    status: string;
    photoUrl?: string;
    language?: string;
    [key: string]: any;
  };
  workspaceId?: number; // Injected by WorkspaceContextMiddleware (from X-Workspace-Id header or workspaceId query param)
  workspace?: {
    id: number;
    ownerId: number;
    name: string;
    slug: string;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

