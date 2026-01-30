import { Controller, Get, Post, Put, Delete, Body, Param, Req, Res, ParseIntPipe, Query } from '@nestjs/common';
import { Response } from 'express';
import { WorkspacesService } from './workspaces.service';
import { ApiRequest } from '../../common/types/request.types';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,
  ResendWorkspaceInvitationDto,
} from './dto/workspaces.dto';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) { }

  /**
   * Create a new workspace (caller becomes owner).
   * @param dto - Workspace name and optional image
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (workspace or error)
   */
  @Post()
  async createWorkspace(@Body() dto: CreateWorkspaceDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.createWorkspace(
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * List workspaces the current user is a member of.
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (workspaces array)
   */
  @Get()
  async getWorkspaces(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.getWorkspaces(request.user!.id, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Get workspace by ID with plan features and limits.
   * @param id - Workspace ID
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (workspace or 404)
   */
  @Get(':id')
  async getWorkspace(@Param('id', ParseIntPipe) id: number, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.getWorkspace(
      id,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Update workspace name/image; slug regenerated if name changes.
   * @param id - Workspace ID
   * @param dto - Name and/or image to update
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (workspace or error)
   */
  @Put(':id')
  async updateWorkspace(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkspaceDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.workspacesService.updateWorkspace(
      id,
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Delete workspace (owner only).
   * @param id - Workspace ID
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Delete(':id')
  async deleteWorkspace(@Param('id', ParseIntPipe) id: number, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.deleteWorkspace(
      id,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * List workspace members.
   * @param id - Workspace ID
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (members array)
   */
  @Get(':id/members')
  async getWorkspaceMembers(@Param('id', ParseIntPipe) id: number, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.getWorkspaceMembers(
      id,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Invite user by email; creates shadow user if needed and sends invitation.
   * @param id - Workspace ID
   * @param dto - Email and optional role
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (invitation or error)
   */
  @Post(':id/members')
  async inviteMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InviteWorkspaceMemberDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.workspacesService.inviteMember(
      id,
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Update workspace member role.
   * @param id - Workspace ID
   * @param memberUserId - User ID of member to update
   * @param dto - New role
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Put(':id/members/:userId')
  async updateMemberRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Body() dto: UpdateWorkspaceMemberRoleDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.workspacesService.updateMemberRole(
      id,
      memberUserId,
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Remove member from workspace.
   * @param id - Workspace ID
   * @param memberUserId - User ID of member to remove
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.workspacesService.removeMember(
      id,
      memberUserId,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Preview invitation by token (public; no auth required).
   * @param token - Invitation token from email link
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (invitation preview or error)
   */
  @Get('invitations/preview')
  async previewInvitation(@Query('token') token: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.previewInvitation(token, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Accept workspace invitation by token; adds user to workspace.
   * @param token - Invitation token from email link
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('invitations/accept')
  async acceptInvitation(@Query('token') token: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.acceptInvitation(
      token,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /** Reject workspace invitation by token. */
  @Post('invitations/reject')
  async rejectInvitation(@Query('token') token: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.rejectInvitation(
      token,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Resend invitation email with new token.
   * @param id - Workspace ID
   * @param dto - Member ID or email to resend for
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post(':id/invitations/resend')
  async resendInvitation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResendWorkspaceInvitationDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.workspacesService.resendInvitation(
      id,
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}

