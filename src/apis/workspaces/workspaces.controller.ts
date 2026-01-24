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

  @Post()
  async createWorkspace(@Body() dto: CreateWorkspaceDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.createWorkspace(
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Get()
  async getWorkspaces(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.getWorkspaces(request.user!.id, request);
    response.status(status).json(restOfResponse);
  }

  @Get(':id')
  async getWorkspace(@Param('id', ParseIntPipe) id: number, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.getWorkspace(
      id,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

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

  @Delete(':id')
  async deleteWorkspace(@Param('id', ParseIntPipe) id: number, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.deleteWorkspace(
      id,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Get(':id/members')
  async getWorkspaceMembers(@Param('id', ParseIntPipe) id: number, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.getWorkspaceMembers(
      id,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

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

  @Get('invitations/preview')
  async previewInvitation(@Query('token') token: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.previewInvitation(token, request);
    response.status(status).json(restOfResponse);
  }

  @Post('invitations/accept')
  async acceptInvitation(@Query('token') token: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.acceptInvitation(
      token,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Post('invitations/reject')
  async rejectInvitation(@Query('token') token: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.workspacesService.rejectInvitation(
      token,
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

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

