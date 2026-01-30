import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../../repositories/workspace-invitation.repository';
import { SubscriptionRepository } from '../../repositories/subscription.repository';
import { PlanRepository } from '../../repositories/plan.repository';
import { WorkspacesValidator } from './workspaces.validator';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,
  ResendWorkspaceInvitationDto,
} from './dto/workspaces.dto';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';
import { WorkspaceMemberRole } from '@prisma/client';
import { buildPlanFeaturesAndLimits } from '../../helpers/plan-features.helper';
import { generateSlug, generateUniqueSlugFromMax } from '../../utils/slug.util';
import { UserRepository } from '../../repositories/user.repository';
import { EmailService } from '../../common/services/email/email.service';
import { InboxService } from '../../common/services/inbox/inbox.service';
import { randomBytes } from 'crypto';
import * as moment from 'moment';

/**
 * Manages workspaces, members, and invitations; integrates with email and inbox for invites.
 */
@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspaceMemberRepository: WorkspaceMemberRepository,
    private readonly workspaceInvitationRepository: WorkspaceInvitationRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly userRepository: UserRepository,
    private readonly workspacesValidator: WorkspacesValidator,
    private readonly i18n: I18nService,
    private readonly emailService: EmailService,
    private readonly inboxService: InboxService,
  ) { }

  /**
   * Create workspace; caller becomes owner and first member.
   * @param userId - User ID (becomes owner)
   * @param dto - Workspace name and optional image
   * @param request - API request (language, etc.)
   * @returns Success response with workspace or error response
   */
  async createWorkspace(userId: number, dto: CreateWorkspaceDto, request: ApiRequest): Promise<any> {
    try {
      const { dto: validatedDto, ownerId } = await this.workspacesValidator.validateCreateWorkspace(dto, userId, request.language);

      const baseSlug = generateSlug(validatedDto.name);
      const maxNumber = await this.workspaceRepository.getMaxSlugNumber(ownerId, baseSlug);
      const slug = generateUniqueSlugFromMax(baseSlug, maxNumber);

      const workspace = await this.workspaceRepository.createWithOwnerMember(
        {
          name: validatedDto.name,
          slug,
          ownerId,
        },
        ownerId,
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.CREATED,
        message: translate(this.i18n, 'workspaces.created', request.language),
        data: workspace,
      });
    } catch (error) {
      LoggerService.error(`Error creating workspace: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * List workspaces the user is a member of.
   * @param userId - User ID
   * @param request - API request (language, etc.)
   * @returns Success response with workspaces array or error response
   */
  async getWorkspaces(userId: number, request: ApiRequest): Promise<any> {
    try {
      const workspaces = await this.workspaceRepository.findAllByUserId(userId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.retrieved', request.language),
        data: workspaces,
      });
    } catch (error) {
      LoggerService.error(`Error fetching workspaces: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Get workspace by ID with plan features and limits.
   * @param workspaceId - Workspace ID
   * @param userId - User ID (must be member)
   * @param request - API request (language, etc.)
   * @returns Success response with workspace and plan/features/limits or error response
   */
  async getWorkspace(workspaceId: number, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { workspace } = await this.workspacesValidator.validateGetWorkspace(workspaceId, userId, request.language);

      const subscription = await this.subscriptionRepository.findWorkspaceOwnerActiveSubscription(workspaceId);
      const fallbackPlan = await this.planRepository.findFreePlan();
      const planFeatures = buildPlanFeaturesAndLimits(subscription, fallbackPlan);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.retrieved', request.language),
        data: {
          ...workspace,
          plan: planFeatures.plan,
          features: planFeatures.features,
          limits: planFeatures.limits,
        },
      });
    } catch (error) {
      LoggerService.error(`Error fetching workspace: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /** Update workspace name/image; slug regenerated if name changes. */
  async updateWorkspace(
    workspaceId: number,
    userId: number,
    dto: UpdateWorkspaceDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { dto: validatedDto, workspace: existingWorkspace } = await this.workspacesValidator.validateUpdateWorkspace(
        dto,
        workspaceId,
        userId,
        request.language,
      );

      const updateData: { name?: string; image?: string | null; slug?: string } = { ...validatedDto };
      if (validatedDto.name && validatedDto.name !== existingWorkspace.name) {
        const baseSlug = generateSlug(validatedDto.name);
        const maxNumber = await this.workspaceRepository.getMaxSlugNumber(userId, baseSlug);
        updateData.slug = generateUniqueSlugFromMax(baseSlug, maxNumber);
      }

      const updatedWorkspace = await this.workspaceRepository.update(workspaceId, updateData);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.updated', request.language),
        data: updatedWorkspace,
      });
    } catch (error) {
      LoggerService.error(`Error updating workspace: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Delete workspace (owner only).
   * @param workspaceId - Workspace ID
   * @param userId - User ID (must be owner)
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async deleteWorkspace(workspaceId: number, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { workspace } = await this.workspacesValidator.validateDeleteWorkspace(workspaceId, userId, request.language);

      await this.workspaceRepository.delete(workspaceId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.deleted', request.language),
        data: { id: workspace.id },
      });
    } catch (error) {
      LoggerService.error(`Error deleting workspace: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * List workspace members; caller must be a member of the workspace.
   * @param workspaceId - Workspace ID
   * @param userId - User ID (must be member)
   * @param request - API request (language, etc.)
   * @returns Success response with members array or error response
   */
  async getWorkspaceMembers(workspaceId: number, userId: number, request: ApiRequest): Promise<any> {
    try {
      await this.workspacesValidator.validateGetWorkspace(workspaceId, userId, request.language);

      const members = await this.workspaceMemberRepository.findAllByWorkspaceId(workspaceId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.membersRetrieved', request.language),
        data: members,
      });
    } catch (error) {
      LoggerService.error(`Error fetching workspace members: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Invite user by email; creates shadow user if needed, sends email and inbox notification.
   * @param workspaceId - Workspace ID
   * @param userId - User ID (inviter; must have permission)
   * @param dto - Email and optional role
   * @param request - API request (language, etc.)
   * @returns Success response with invitation details or error response
   */
  async inviteMember(
    workspaceId: number,
    userId: number,
    dto: InviteWorkspaceMemberDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { dto: validatedDto, workspace, inviterName } = await this.workspacesValidator.validateInviteMember(
        dto,
        workspaceId,
        userId,
        request.language,
      );

      let invitee = await this.userRepository.findByEmail(validatedDto.email);
      if (!invitee) {
        invitee = await this.userRepository.createShadowUser(validatedDto.email);
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      const invitation = await this.workspaceInvitationRepository.create({
        workspaceId,
        email: validatedDto.email,
        token,
        role: validatedDto.role as WorkspaceMemberRole,
        inviterId: userId,
        inviteeId: invitee.id,
        expiresAt,
      });

      await this.inboxService.create(
        invitee.id,
        'workspace-invitation',
        invitee.language || 'en',
        {
          workspaceName: workspace.name,
          token,
          inviterName,
          role: validatedDto.role,
        }
      );

      await this.emailService.sendWorkspaceInvitation(
        invitee.email,
        invitee.language || 'en',
        {
          workspaceName: workspace.name,
          token,
          inviterName,
          role: validatedDto.role,
        }
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.CREATED,
        message: translate(this.i18n, 'workspaces.memberInvited', request.language),
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error) {
      LoggerService.error(`Error inviting member: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Accept invitation by token; adds user as member and deletes invitation.
   * @param token - Invitation token from email or inbox
   * @param userId - User ID (must match invitee)
   * @param request - API request (language, etc.)
   * @returns Success response with member details or error response
   */
  async acceptInvitation(token: string, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { invitation, user } = await this.workspacesValidator.validateAcceptInvitation(
        token,
        userId,
        request.language,
      );

      const member = await this.workspaceInvitationRepository.acceptInvitationAndCreateMember(
        invitation.workspaceId,
        user.id,
        invitation.role,
        token,
        new Date(),
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.invitationAccepted', request.language),
        data: member,
      });
    } catch (error) {
      LoggerService.error(`Error accepting invitation: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Resend invitation with new token and email.
   * @param workspaceId - Workspace ID
   * @param userId - User ID (must have permission)
   * @param dto - Member ID or email to resend for
   * @param request - API request (language, etc.)
   * @returns Success response with invitation details or error response
   */
  async resendInvitation(
    workspaceId: number,
    userId: number,
    dto: ResendWorkspaceInvitationDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { invitation, workspace, inviterName } = await this.workspacesValidator.validateResendInvitation(
        dto,
        workspaceId,
        userId,
        request.language,
      );

      const token = randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      // Update invitation with new token and expiration
      await this.workspaceInvitationRepository.updateToken(invitation.id, token, expiresAt);

      let invitee = await this.userRepository.findByEmail(invitation.email);
      if (!invitee) {
        invitee = await this.userRepository.createShadowUser(invitation.email);
      }

      await this.inboxService.create(
        invitee.id,
        'workspace-invitation',
        invitee.language || 'en',
        {
          workspaceName: workspace.name,
          token,
          inviterName,
          role: invitation.role,
        }
      );

      await this.emailService.sendWorkspaceInvitation(
        invitee.email,
        invitee.language || 'en',
        {
          workspaceName: workspace.name,
          token,
          inviterName,
          role: invitation.role,
        }
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.invitationResent', request.language),
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt,
        },
      });
    } catch (error) {
      LoggerService.error(`Error resending invitation: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Update a member's role.
   * @param workspaceId - Workspace ID
   * @param memberUserId - User ID of member to update
   * @param userId - User ID (must have permission)
   * @param dto - New role
   * @param request - API request (language, etc.)
   * @returns Success response with updated member or error response
   */
  async updateMemberRole(
    workspaceId: number,
    memberUserId: number,
    userId: number,
    dto: UpdateWorkspaceMemberRoleDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { dto: validatedDto } = await this.workspacesValidator.validateUpdateMemberRole(
        dto,
        workspaceId,
        memberUserId,
        userId,
        request.language,
      );

      const updatedMember = await this.workspaceMemberRepository.updateRole(workspaceId, memberUserId, validatedDto.role);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.memberRoleUpdated', request.language),
        data: updatedMember,
      });
    } catch (error) {
      LoggerService.error(`Error updating member role: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Remove member from workspace.
   * @param workspaceId - Workspace ID
   * @param memberUserId - User ID of member to remove
   * @param userId - User ID (must have permission)
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async removeMember(workspaceId: number, memberUserId: number, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { member } = await this.workspacesValidator.validateRemoveMember(workspaceId, memberUserId, userId, request.language);

      await this.workspaceMemberRepository.remove(workspaceId, memberUserId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.memberRemoved', request.language),
        data: { id: member.id },
      });
    } catch (error) {
      LoggerService.error(`Error removing member: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Preview invitation by token (public; no auth).
   * @param token - Invitation token from email link
   * @param request - API request (language, etc.)
   * @returns Success response with invitation preview or error response
   */
  async previewInvitation(token: string, request: ApiRequest): Promise<any> {
    try {
      const { invitation, emailRegistered, isExpired, isAccepted, isRejected } =
        await this.workspacesValidator.validatePreviewInvitation({ token }, request.language);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.invitationPreview', request.language),
        data: {
          invitation: {
            email: invitation.email,
            workspaceName: invitation.workspaceName,
            inviterName: invitation.inviterName,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
          },
          emailRegistered,
          isExpired,
          isAccepted,
          isRejected,
        },
      });
    } catch (error) {
      LoggerService.error(`Error previewing invitation: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Reject invitation by token.
   * @param token - Invitation token from email link
   * @param userId - User ID (must match invitee)
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async rejectInvitation(token: string, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { invitation } = await this.workspacesValidator.validateRejectInvitation(
        { token },
        userId,
        request.language,
      );

      await this.workspaceInvitationRepository.markAsRejected(token, new Date());

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'workspaces.invitationRejected', request.language),
        data: {
          email: invitation.email,
          workspaceName: invitation.workspaceName,
        },
      });
    } catch (error) {
      LoggerService.error(`Error rejecting invitation: ${error}`);
      return generateErrorResponse(error);
    }
  }
}

