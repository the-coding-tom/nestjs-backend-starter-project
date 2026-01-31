import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UserRepository } from '../../repositories/user.repository';
import { throwError } from '../../helpers/response.helper';
import { ErrorCode } from '../../common/enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';
import { validateJoiSchema } from '../../utils/joi.util';
import { UpdateProfileDto } from './dto/profile.dto';
import { config } from '../../config/config';
import * as Joi from 'joi';

@Injectable()
export class ProfileValidator {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Validate that the user exists and return the profile entity.
   * @param userId - User ID from JWT
   * @param language - Request language
   * @returns Profile entity from raw SQL
   */
  async validateGetProfile(userId: number, language: string): Promise<{ profile: any }> {
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', language),
        'any.required': translate(this.i18n, 'validation.userId.required', language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { userId, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const profile = await this.userRepository.findProfileById(userId);

    if (!profile) {
      throwError(
        translate(this.i18n, 'validation.userNotFound', language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    return { profile };
  }

  /**
   * Validate UpdateProfileDto; at least one field must be provided.
   * @param dto - Request body
   * @param language - Request language for i18n
   * @returns Validated DTO
   */
  async validateUpdateProfile(dto: UpdateProfileDto, language: string): Promise<{ dto: UpdateProfileDto }> {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100).optional().messages({
        'string.min': translate(this.i18n, 'validation.name.min', language),
      }),
      firstName: Joi.string().max(50).allow('').optional(),
      lastName: Joi.string().max(50).allow('').optional(),
      photoUrl: Joi.string().uri().max(500).allow(null, '').optional().messages({
        'string.uri': translate(this.i18n, 'validation.url.invalid', language),
      }),
      timezone: Joi.string().max(50).optional(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .optional()
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', language),
        }),
    })
      .min(1)
      .messages({
        'object.min': translate(this.i18n, 'validation.profileUpdateEmpty', language),
      });

    const error = validateJoiSchema(schema, dto);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    return { dto };
  }
}
