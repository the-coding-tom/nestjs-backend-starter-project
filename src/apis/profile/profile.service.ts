import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { UserRepository } from '../../repositories/user.repository';
import { ProfileValidator } from './profile.validator';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly profileValidator: ProfileValidator,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Get current user's profile.
   * @param userId - User ID from JWT
   * @param request - API request (language, etc.)
   * @returns Success response with profile or error response
   */
  async getProfile(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { profile } = await this.profileValidator.validateGetProfile(userId, request.language!);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'profile.retrieved', request.language),
        data: profile,
      });
    } catch (error) {
      LoggerService.error(`Error fetching profile: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Update current user's profile.
   * @param userId - User ID from JWT
   * @param dto - Fields to update
   * @param request - API request (language, etc.)
   * @returns Success response with updated profile or error response
   */
  async updateProfile(userId: number, dto: UpdateProfileDto, request: ApiRequest): Promise<any> {
    try {
      const { dto: validatedDto } = await this.profileValidator.validateUpdateProfile(dto, request.language!);

      const profile = await this.userRepository.updateAndFindProfile(userId, validatedDto);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'profile.updated', request.language),
        data: profile,
      });
    } catch (error) {
      LoggerService.error(`Error updating profile: ${error}`);
      return generateErrorResponse(error);
    }
  }
}
