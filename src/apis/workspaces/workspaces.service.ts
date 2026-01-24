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

  async createWorkspace(userId: number, dto: CreateWorkspaceDto, request: ApiRequest): Promise<any> {
    try {
      const { dto: validatedDto, ownerId } = await this.workspacesValidator.validateCreateWorkspace(dto, userId, request.language);

      // Generate unique slug from workspace name
      const baseSlug = generateSlug(validatedDto.name);
      const maxNumber = await this.workspaceRepository.getMaxSlugNumber(ownerId, baseSlug);
      const slug = generateUniqueSlugFromMax(baseSlug, maxNumber);

      // Create workspace with owner as member using repository transaction method
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

  async getWorkspace(workspaceId: number, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { workspace } = await this.workspacesValidator.validateGetWorkspace(workspaceId, userId, request.language);

      // Get subscription info
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

      // Auto-regenerate slug if name changed
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

      // Check if user exists or create Shadow User
      let invitee = await this.userRepository.findByEmail(validatedDto.email);
      if (!invitee) {
        invitee = await this.userRepository.createShadowUser(validatedDto.email);
      }

      // Generate invitation token
      const token = randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      // Create invitation
      const invitation = await this.workspaceInvitationRepository.create({
        workspaceId,
        email: validatedDto.email,
        token,
        role: validatedDto.role as WorkspaceMemberRole,
        inviterId: userId,
        inviteeId: invitee.id,
        expiresAt,
      });

      // Create inbox notification
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

      // Send workspace invitation email
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

  async acceptInvitation(token: string, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { invitation, user } = await this.workspacesValidator.validateAcceptInvitation(
        token,
        userId,
        request.language,
      );

      // Accept invitation and create member in a single transaction
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

      // Generate new invitation token
      const token = randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      // Update invitation with new token and expiration
      await this.workspaceInvitationRepository.updateToken(invitation.id, token, expiresAt);

      // Find or create invitee user
      let invitee = await this.userRepository.findByEmail(invitation.email);
      if (!invitee) {
        invitee = await this.userRepository.createShadowUser(invitation.email);
      }

      // Create inbox notification
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

      // Send workspace invitation email
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

  async rejectInvitation(token: string, userId: number, request: ApiRequest): Promise<any> {
    try {
      const { invitation } = await this.workspacesValidator.validateRejectInvitation(
        { token },
        userId,
        request.language,
      );

      // Mark invitation as rejected
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

