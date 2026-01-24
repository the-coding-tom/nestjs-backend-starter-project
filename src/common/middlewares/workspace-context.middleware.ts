import {
  HttpStatus,
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ApiRequest } from '../types/request.types';
import { ErrorCode } from '../enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { validateJoiSchema } from '../../utils/joi.util';
import * as Joi from 'joi';

/**
 * Workspace context middleware
 * Extracts workspace ID from header (X-Workspace-Id) or query parameter (workspaceId)
 * Validates user has access to the workspace (owner or member)
 * Injects workspace context into request
 */
@Injectable()
export class WorkspaceContextMiddleware implements NestMiddleware {
  constructor(
    private readonly i18n: I18nService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspaceMemberRepository: WorkspaceMemberRepository,
  ) {}

  async use(req: ApiRequest, res: Response, next: NextFunction) {
    const lang = req.language;

    // Workspace context is optional - if not provided, skip
    const workspaceIdHeader = req.headers['x-workspace-id'] as string;
    const workspaceIdQuery = req.query.workspaceId as string;
    const workspaceIdValue = workspaceIdHeader || workspaceIdQuery;

    if (!workspaceIdValue) {
      // No workspace context provided - this is allowed for routes that don't need it
      return next();
    }

    if (!req.userId || !req.user) {
      // User must be authenticated to access workspace context
      const message = translate(this.i18n, 'common.authenticationRequired', lang);
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message,
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
      });
    }

    // Validate workspaceId format (must be a positive integer)
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', lang) || 'Workspace ID must be a number',
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', lang) || 'Workspace ID must be an integer',
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', lang) || 'Workspace ID must be positive',
        'any.required': translate(this.i18n, 'validation.workspaceId.required', lang) || 'Workspace ID is required',
      }),
    });

    // Parse to number for validation
    const workspaceIdNum = parseInt(workspaceIdValue, 10);
    const error = validateJoiSchema(schema, { workspaceId: workspaceIdNum });
    if (error) {
      throw new BadRequestException({
        message: error,
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    }

    const workspaceId = workspaceIdNum;

    // Fetch workspace with owner info
    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      const message = translate(this.i18n, 'errors.workspaceNotFound', lang);
      throw new BadRequestException({
        message,
        errorCode: ErrorCode.WORKSPACE_NOT_FOUND,
      });
    }

    // Check if user has access (owner or member)
    const isOwner = workspace.ownerId === req.userId;
    const membership = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, req.userId);

    if (!isOwner && !membership) {
      const message = translate(this.i18n, 'errors.workspaceAccessDenied', lang) || 'Access denied to this workspace';
      throw new ForbiddenException({
        message,
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
      });
    }

    // Inject workspace context into request
    req.workspaceId = workspaceId;
    req.workspace = {
      id: workspace.id,
      ownerId: workspace.ownerId,
      name: workspace.name,
      slug: workspace.slug,
      image: workspace.image,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };

    next();
  }
}

