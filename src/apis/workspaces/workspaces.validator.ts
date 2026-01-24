import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../../repositories/workspace-invitation.repository';
import { UserRepository } from '../../repositories/user.repository';
import { PlanRepository } from '../../repositories/plan.repository';
import { SubscriptionRepository } from '../../repositories/subscription.repository';
import { throwError } from '../../helpers/response.helper';
import { ErrorCode } from '../../common/enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';
import { validateJoiSchema } from '../../utils/joi.util';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,
  ResendWorkspaceInvitationDto,
  PreviewInvitationDto,
  RejectInvitationDto,
} from './dto/workspaces.dto';
import { buildPlanFeaturesAndLimits } from '../../helpers/plan-features.helper';
import { canManageTeam } from '../../helpers/workspace-permission.helper';
import * as Joi from 'joi';

@Injectable()
export class WorkspacesValidator {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspaceMemberRepository: WorkspaceMemberRepository,
    private readonly workspaceInvitationRepository: WorkspaceInvitationRepository,
    private readonly userRepository: UserRepository,
    private readonly planRepository: PlanRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly i18n: I18nService,
  ) {}

  async validateCreateWorkspace(
    dto: CreateWorkspaceDto,
    userId: number,
    language: string,
  ): Promise<{ dto: CreateWorkspaceDto; ownerId: number }> {
    const schema = Joi.object({
      name: Joi.string().min(1).max(100).required().messages({
        'string.base': translate(this.i18n, 'validation.name.required', language),
        'string.min': translate(this.i18n, 'validation.name.min', language),
        'any.required': translate(this.i18n, 'validation.name.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Check maxWorkspaces limit using user's subscription
    const userSubscription = await this.subscriptionRepository.findActiveByUserId(userId);
    const freePlan = await this.planRepository.findFreePlan();
    const plan = userSubscription?.Plan || freePlan;

    if (!plan) {
      throwError(
        translate(this.i18n, 'errors.planNotFound', language),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.PLAN_NOT_FOUND,
      );
    }

    const workspaceCount = await this.workspaceRepository.countByOwnerId(userId);
    if (workspaceCount >= plan.maxWorkspaces) {
      throwError(
        translate(this.i18n, 'errors.workspaceLimitExceeded', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    return { dto, ownerId: userId };
  }

  async validateGetWorkspace(workspaceId: number, userId: number, language: string): Promise<{ workspace: any }> {
    // Validate path parameters
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { workspaceId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    // Check access
    const isOwner = workspace.ownerId === userId;
    const membership = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, userId);

    if (!isOwner && !membership) {
      throwError(
        translate(this.i18n, 'errors.workspaceAccessDenied', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }

    return { workspace };
  }

  async validateUpdateWorkspace(
    dto: UpdateWorkspaceDto,
    workspaceId: number,
    userId: number,
    language: string,
  ): Promise<{ dto: UpdateWorkspaceDto; workspace: any }> {
    // Validate path parameters and body
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      name: Joi.string().min(1).max(100).optional(),
      image: Joi.string().uri().allow(null).optional(),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, workspaceId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    // Only owner can update
    if (workspace.ownerId !== userId) {
      throwError(
        translate(this.i18n, 'errors.workspaceAccessDenied', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }

    return { dto, workspace };
  }

  async validateDeleteWorkspace(workspaceId: number, userId: number, language: string): Promise<{ workspace: any }> {
    // Validate path parameters
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { workspaceId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    if (workspace.ownerId !== userId) {
      throwError(
        translate(this.i18n, 'errors.workspaceAccessDenied', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }

    return { workspace };
  }

  async validateInviteMember(
    dto: InviteWorkspaceMemberDto,
    workspaceId: number,
    userId: number,
    language: string,
  ): Promise<{ dto: InviteWorkspaceMemberDto; workspace: any; inviterName: string }> {
    // Validate path parameters and body
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'string.email': translate(this.i18n, 'validation.email.invalid', language),
        'any.required': translate(this.i18n, 'validation.email.required', language),
      }),
      role: Joi.string().valid('MANAGER', 'MEMBER', 'READ_ONLY').optional().default('MEMBER'),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, workspaceId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    // Check if user has permission (owner or manager)
    const membership = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, userId);

    if (!canManageTeam(workspace, userId, membership)) {
      throwError(
        translate(this.i18n, 'errors.workspaceAccessDenied', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }

    // Check seat limit using workspace owner's subscription
    const subscription = await this.subscriptionRepository.findWorkspaceOwnerActiveSubscription(workspaceId);
    const fallbackPlan = await this.planRepository.findFreePlan();
    const { limits } = buildPlanFeaturesAndLimits(subscription, fallbackPlan);
    const currentMemberCount = await this.workspaceMemberRepository.countByWorkspaceId(workspaceId);
    const totalSeats = currentMemberCount + 1; // +1 for owner

    if (totalSeats >= limits.maxSeats) {
      throwError(
        translate(this.i18n, 'errors.seatLimitExceeded', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.SEAT_LIMIT_EXCEEDED,
      );
    }

    // Check if user exists and is already a member
    const invitee = await this.userRepository.findByEmail(dto.email);
    if (invitee) {
      // Check if already a member
      const existingMember = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, invitee.id);
      if (existingMember) {
        throwError(
          translate(this.i18n, 'errors.workspaceMemberAlreadyExists', language),
          HttpStatus.CONFLICT,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      // Check if trying to invite owner
      if (invitee.id === workspace.ownerId) {
        throwError(
          translate(this.i18n, 'errors.cannotInviteOwner', language),
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    // Check if there's already a pending invitation for this email/workspace
    const existingInvitation = await this.workspaceInvitationRepository.findByWorkspaceAndEmail(workspaceId, dto.email);
    if (existingInvitation) {
      throwError(
        translate(this.i18n, 'errors.workspaceInvitationAlreadyExists', language),
        HttpStatus.CONFLICT,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Get inviter's name for email
    const inviter = await this.userRepository.findById(userId);
    if (!inviter) {
      throwError(
        translate(this.i18n, 'errors.userNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    const inviterName = inviter.name || inviter.email.split('@')[0] || 'A team member';

    return { dto, workspace, inviterName };
  }

  async validateAcceptInvitation(
    token: string,
    userId: number,
    language: string,
  ): Promise<{ invitation: any; user: any }> {
    // Validate token
    const schema = Joi.object({
      token: Joi.string().required().messages({
        'string.base': translate(this.i18n, 'validation.tokenInvalid', language),
        'any.required': translate(this.i18n, 'validation.token.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { token, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Find invitation by token
    const invitation = await this.workspaceInvitationRepository.findByToken(token);

    if (!invitation) {
      throwError(
        translate(this.i18n, 'errors.invitationNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if invitation is already accepted
    if (invitation.acceptedAt) {
      throwError(
        translate(this.i18n, 'errors.invitationAlreadyAccepted', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expiresAt) < new Date()) {
      throwError(
        translate(this.i18n, 'errors.invitationExpired', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Get current user
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throwError(
        translate(this.i18n, 'errors.userNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    // Check if email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throwError(
        translate(this.i18n, 'errors.invitationEmailMismatch', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if already a member
    const existingMember = await this.workspaceMemberRepository.findByWorkspaceAndUser(
      invitation.workspaceId,
      userId,
    );
    if (existingMember) {
      throwError(
        translate(this.i18n, 'errors.workspaceMemberAlreadyExists', language),
        HttpStatus.CONFLICT,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    return { invitation, user };
  }

  async validateResendInvitation(
    dto: ResendWorkspaceInvitationDto,
    workspaceId: number,
    userId: number,
    language: string,
  ): Promise<{ invitation: any; workspace: any; inviterName: string }> {
    // Validate path parameters and body
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'string.email': translate(this.i18n, 'validation.email.invalid', language),
        'any.required': translate(this.i18n, 'validation.email.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, workspaceId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    // Check if user has permission (owner or manager)
    const membership = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, userId);

    if (!canManageTeam(workspace, userId, membership)) {
      throwError(
        translate(this.i18n, 'errors.workspaceAccessDenied', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }

    // Find existing pending invitation
    const invitation = await this.workspaceInvitationRepository.findByWorkspaceAndEmail(workspaceId, dto.email);

    if (!invitation) {
      throwError(
        translate(this.i18n, 'errors.invitationNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Get inviter's name for email
    const inviter = await this.userRepository.findById(userId);
    if (!inviter) {
      throwError(
        translate(this.i18n, 'errors.userNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    const inviterName = inviter.name || inviter.email.split('@')[0] || 'A team member';

    return { invitation, workspace, inviterName };
  }

  async validateUpdateMemberRole(
    dto: UpdateWorkspaceMemberRoleDto,
    workspaceId: number,
    memberUserId: number,
    userId: number,
    language: string,
  ): Promise<{ dto: UpdateWorkspaceMemberRoleDto; workspace: any; member: any }> {
    // Validate path parameters and body
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      memberUserId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      role: Joi.string().valid('OWNER', 'MANAGER', 'MEMBER', 'READ_ONLY').required().messages({
        'any.only': translate(this.i18n, 'validation.role.invalid', language),
        'any.required': translate(this.i18n, 'validation.role.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, workspaceId, memberUserId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    // Only owner can update member roles
    if (workspace.ownerId !== userId) {
      throwError(
        translate(this.i18n, 'errors.workspaceAccessDenied', language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }

    // Cannot change owner role
    if (dto.role === 'OWNER') {
      throwError(
        translate(this.i18n, 'errors.cannotChangeOwnerRole', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Cannot change role of owner
    if (memberUserId === workspace.ownerId) {
      throwError(
        translate(this.i18n, 'errors.cannotChangeOwnerRole', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const member = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, memberUserId);

    if (!member) {
      throwError(
        translate(this.i18n, 'errors.workspaceMemberNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_MEMBER_NOT_FOUND,
      );
    }

    return { dto, workspace, member };
  }

  async validateRemoveMember(
    workspaceId: number,
    memberUserId: number,
    userId: number,
    language: string,
  ): Promise<{ workspace: any; member: any }> {
    // Validate path parameters
    const schema = Joi.object({
      workspaceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.integer': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'number.positive': translate(this.i18n, 'validation.invalidWorkspaceId', language),
        'any.required': translate(this.i18n, 'validation.workspaceId.required', language),
      }),
      memberUserId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { workspaceId, memberUserId, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const workspace = await this.workspaceRepository.findById(workspaceId);

    if (!workspace) {
      throwError(
        translate(this.i18n, 'errors.workspaceNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_NOT_FOUND,
      );
    }

    // Only owner or manager can remove members (or member can remove themselves)
    const isOwner = workspace.ownerId === userId;
    const isRemovingSelf = memberUserId === userId;
    const membership = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, userId);

    if (!isOwner && !isRemovingSelf) {
      if (!canManageTeam(workspace, userId, membership)) {
        throwError(
          translate(this.i18n, 'errors.workspaceAccessDenied', language),
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTHENTICATION_ERROR,
        );
      }
    }

    // Cannot remove owner
    if (memberUserId === workspace.ownerId) {
      throwError(
        translate(this.i18n, 'errors.cannotRemoveOwner', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const member = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, memberUserId);

    if (!member) {
      throwError(
        translate(this.i18n, 'errors.workspaceMemberNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.WORKSPACE_MEMBER_NOT_FOUND,
      );
    }

    return { workspace, member };
  }

  async validatePreviewInvitation(
    dto: PreviewInvitationDto,
    language: string,
  ): Promise<{ invitation: any; emailRegistered: boolean; isExpired: boolean; isAccepted: boolean; isRejected: boolean }> {
    // Validate token
    const schema = Joi.object({
      token: Joi.string().required().messages({
        'string.base': translate(this.i18n, 'validation.tokenInvalid', language),
        'any.required': translate(this.i18n, 'validation.token.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Find invitation by token
    const invitation = await this.workspaceInvitationRepository.findByToken(dto.token);

    if (!invitation) {
      throwError(
        translate(this.i18n, 'errors.invitationNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if email is registered (excluding shadow users)
    const emailRegistered = await this.userRepository.isEmailRegistered(invitation.email);

    // Check invitation status
    const isExpired = new Date(invitation.expiresAt) < new Date();
    const isAccepted = !!invitation.acceptedAt;
    const isRejected = !!invitation.rejectedAt;

    return { invitation, emailRegistered, isExpired, isAccepted, isRejected };
  }

  async validateRejectInvitation(
    dto: RejectInvitationDto,
    userId: number,
    language: string,
  ): Promise<{ invitation: any; user: any }> {
    // Validate token
    const schema = Joi.object({
      token: Joi.string().required().messages({
        'string.base': translate(this.i18n, 'validation.tokenInvalid', language),
        'any.required': translate(this.i18n, 'validation.token.required', language),
      }),
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...dto, userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Find invitation by token
    const invitation = await this.workspaceInvitationRepository.findByToken(dto.token);

    if (!invitation) {
      throwError(
        translate(this.i18n, 'errors.invitationNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if invitation is already accepted
    if (invitation.acceptedAt) {
      throwError(
        translate(this.i18n, 'errors.invitationAlreadyAccepted', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if invitation is already rejected
    if (invitation.rejectedAt) {
      throwError(
        translate(this.i18n, 'errors.invitationAlreadyRejected', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expiresAt) < new Date()) {
      throwError(
        translate(this.i18n, 'errors.invitationExpired', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Get current user
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throwError(
        translate(this.i18n, 'errors.userNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    // Check if email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throwError(
        translate(this.i18n, 'errors.invitationEmailMismatch', language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    return { invitation, user };
  }
}