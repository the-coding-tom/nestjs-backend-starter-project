import { Controller, Get, Patch, Body, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { ProfileService } from './profile.service';
import { ApiRequest } from '../../common/types/request.types';
import { UpdateProfileDto } from './dto/profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * Get current user's profile.
   * @param request - API request (user context from JWT)
   * @param response - Express response for status and body
   * @returns Response sent via response (profile or error)
   */
  @Get()
  async getProfile(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.profileService.getProfile(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Update current user's profile.
   * @param dto - Fields to update (name, firstName, lastName, photoUrl, timezone, language)
   * @param request - API request (user context from JWT)
   * @param response - Express response for status and body
   * @returns Response sent via response (updated profile or error)
   */
  @Patch()
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.profileService.updateProfile(
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}
