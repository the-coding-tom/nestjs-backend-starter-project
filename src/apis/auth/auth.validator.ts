import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UserStatus, VerificationRequestType } from '@prisma/client';
import { ErrorCode } from '../../common/enums/generic.enum';
import { UserRepository } from '../../repositories/user.repository';
import { SessionRepository } from '../../repositories/session.repository';
import { VerificationRequestRepository } from '../../repositories/verification-request.repository';
import { BackupCodeRepository } from '../../repositories/backup-code.repository';
import { MfaChallengeSessionRepository } from '../../repositories/mfa-challenge-session.repository';
import { PlanRepository } from '../../repositories/plan.repository';
import { validateJoiSchema } from '../../utils/joi.util';
import { throwError } from '../../helpers/response.helper';
import { validatePassword } from '../../utils/password.util';
import { verifyTotpCode } from '../../helpers/totp.helper';
import { hashBackupCode } from '../../utils/backup-code.util';
import { MfaChallengeSessionStatus } from '@prisma/client';
import { translate } from '../../helpers/i18n.helper';
import { config } from '../../config/config';
import {
  LoginDto,
  OAuthCallbackDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordRequestDto,
  ResetPasswordConfirmDto,
  RegisterDto,
  VerifyEmailDto,
  ResendVerificationDto,
  MfaVerifyDto,
  MfaChallengeDto,
  MfaBackupCodeConsumeDto,
  MfaDisableDto,
  MfaRegenerateBackupCodesDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { UserEntity, UserWithAuthEntity } from '../../repositories/entities/user.entity';
import * as Joi from 'joi';

@Injectable()
export class AuthValidator {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly verificationRequestRepository: VerificationRequestRepository,
    private readonly backupCodeRepository: BackupCodeRepository,
    private readonly mfaChallengeSessionRepository: MfaChallengeSessionRepository,
    private readonly planRepository: PlanRepository,
    private readonly i18n: I18nService,
  ) { }

  async validateLogin(data: LoginDto & { language: string }): Promise<{ dto: LoginDto; user: UserEntity }> {
    const schema = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
          'string.email': translate(this.i18n, 'validation.email.invalid', data.language),
          'any.required': translate(this.i18n, 'validation.email.required', data.language),
        }),
      password: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.password.required', data.language),
      }),
      rememberMe: Joi.boolean().optional(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      const message = translate(this.i18n, 'validation.invalidCredentials', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.emailVerifiedAt) {
      const message = translate(this.i18n, 'validation.emailNotVerified', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.EMAIL_NOT_VERIFIED);
    }

    if (user.status !== UserStatus.ACTIVE) {
      const message = translate(this.i18n, 'validation.accountInactive', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.ACCOUNT_INACTIVE);
    }

    if (!user.localAuthAccount) {
      const message = translate(this.i18n, 'validation.invalidCredentials', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await validatePassword(
      data.password,
      user.localAuthAccount.passwordHash,
    );
    if (!isPasswordValid) {
      const message = translate(this.i18n, 'validation.invalidCredentials', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    return { dto: data, user };
  }

  async validateOAuthCallback(data: OAuthCallbackDto & { language: string }): Promise<{ dto: OAuthCallbackDto }> {
    const schema = Joi.object({
      code: Joi.string().optional(),
      state: Joi.string().optional(),
      scope: Joi.string().optional(),
      authuser: Joi.string().optional(),
      prompt: Joi.string().optional(),
      error: Joi.string().optional(),
      error_description: Joi.string().optional(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const validationError = validateJoiSchema(schema, data);
    if (validationError) {
      throwError(validationError, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    }

    if (data.error) {
      const baseMessage = translate(this.i18n, 'validation.oauthError', data.language);
      throwError(
        `${baseMessage}: ${data.error_description || data.error}`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.OAUTH_ERROR,
      );
    }

    if (!data.code) {
      const message = translate(this.i18n, 'validation.missingCode', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.MISSING_CODE);
    }

    return { dto: data };
  }

  async validateLogout(data: LogoutDto & { language: string }): Promise<{ dto: LogoutDto }> {
    const schema = Joi.object({
      refreshToken: Joi.string().required(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const validationError = validateJoiSchema(schema, data);
    if (validationError) {
      throwError(validationError, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    }

    return { dto: data };
  }

  async validateRefreshToken(
    data: RefreshTokenDto & { language: string },
  ): Promise<{ dto: RefreshTokenDto; session: any; user: UserEntity }> {
    const schema = Joi.object({
      refreshToken: Joi.string().required(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const validationError = validateJoiSchema(schema, data);
    if (validationError) {
      throwError(validationError, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    }

    const session = await this.sessionRepository.findSessionByRefreshToken(data.refreshToken);
    if (!session) {
      const message = translate(this.i18n, 'validation.tokenInvalid', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN);
    }

    if (session.expiresAt < new Date()) {
      const message = translate(this.i18n, 'validation.tokenExpired', data.language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.EXPIRED_REFRESH_TOKEN);
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    return { dto: data, session, user };
  }

  async validateRegister(data: RegisterDto & { language: string }): Promise<{ dto: RegisterDto & { planId: number }; invitedUser?: UserEntity }> {
    const schema = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
          'string.email': translate(this.i18n, 'validation.email.invalid', data.language),
          'any.required': translate(this.i18n, 'validation.email.required', data.language),
        }),
      password: Joi.string().min(6).required().messages({
        'string.min': translate(this.i18n, 'validation.passwordTooWeak', data.language),
        'any.required': translate(this.i18n, 'validation.password.required', data.language),
      }),
      name: Joi.string().min(2).required().messages({
        'string.min': translate(this.i18n, 'validation.name.min', data.language),
        'any.required': translate(this.i18n, 'validation.name.required', data.language),
      }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser && existingUser.status !== UserStatus.INVITED) {
      const message = translate(this.i18n, 'validation.email.exists', data.language);
      throwError(message, HttpStatus.CONFLICT, ErrorCode.EMAIL_EXISTS);
    }

    const freePlan = await this.planRepository.findFreePlan();
    if (!freePlan) {
      const message = translate(this.i18n, 'errors.freePlanNotFound', data.language);
      throwError(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.SERVER_ERROR);
    }

    // Return invited user (status=INVITED) if found, otherwise undefined
    const invitedUser = existingUser?.status === UserStatus.INVITED ? existingUser : undefined;

    return {
      dto: {
        ...data,
        planId: freePlan.id,
      },
      invitedUser,
    };
  }

  async validateResetPasswordRequest(
    data: ResetPasswordRequestDto & { language: string },
  ): Promise<{ dto: ResetPasswordRequestDto; user: UserEntity | null }> {
    const schema = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
          'string.email': translate(this.i18n, 'validation.email.invalid', data.language),
          'any.required': translate(this.i18n, 'validation.email.required', data.language),
        }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findByEmail(data.email);
    // Return user even if null to prevent email enumeration
    return { dto: data, user };
  }

  async validateResetPasswordConfirm(
    data: ResetPasswordConfirmDto & { language: string },
  ): Promise<{ dto: ResetPasswordConfirmDto; verificationRequest: any; user: UserWithAuthEntity }> {
    const schema = Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(6).required().messages({
        'string.min': translate(this.i18n, 'validation.passwordTooWeak', data.language),
        'any.required': translate(this.i18n, 'validation.password.required', data.language),
      }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const verificationRequest = await this.verificationRequestRepository.findByToken(data.token);
    if (!verificationRequest) {
      const message = translate(this.i18n, 'validation.verificationTokenNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN);
    }

    if (verificationRequest.expiresAt < new Date()) {
      const message = translate(this.i18n, 'validation.verificationTokenExpired', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.EXPIRED_TOKEN);
    }

    if (verificationRequest.type !== VerificationRequestType.PASSWORD_RESET) {
      const message = translate(this.i18n, 'validation.tokenInvalid', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN_TYPE);
    }

    const user = await this.userRepository.findById(verificationRequest.userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    return { dto: data, verificationRequest, user };
  }

  async validateChangePassword(
    data: ChangePasswordDto & { language: string },
    userId: number,
  ): Promise<{ dto: ChangePasswordDto }> {
    const schema = Joi.object({
      currentPassword: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.password.required', data.language),
      }),
      newPassword: Joi.string().min(6).required().messages({
        'string.min': translate(this.i18n, 'validation.passwordTooWeak', data.language),
        'any.required': translate(this.i18n, 'validation.password.required', data.language),
      }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throwError(
        translate(this.i18n, 'validation.userNotFound', data.language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    if (!user.localAuthAccount) {
      throwError(
        translate(this.i18n, 'validation.noLocalPassword', data.language),
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const isPasswordValid = await validatePassword(data.currentPassword, user.localAuthAccount.passwordHash);
    if (!isPasswordValid) {
      throwError(
        translate(this.i18n, 'validation.invalidCredentials', data.language),
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    return { dto: data };
  }

  async validateVerifyEmail(data: VerifyEmailDto & { language: string }): Promise<{ dto: VerifyEmailDto; verificationRequest: any; user: UserEntity }> {
    const schema = Joi.object({
      token: Joi.string().required(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const verificationRequest = await this.verificationRequestRepository.findByToken(data.token);
    if (!verificationRequest) {
      const message = translate(this.i18n, 'validation.verificationTokenNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN);
    }

    if (verificationRequest.expiresAt < new Date()) {
      const message = translate(this.i18n, 'validation.verificationTokenExpired', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.EXPIRED_TOKEN);
    }

    if (verificationRequest.type !== VerificationRequestType.EMAIL_VERIFICATION) {
      const message = translate(this.i18n, 'validation.tokenInvalid', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN_TYPE);
    }

    const user = await this.userRepository.findById(verificationRequest.userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    return { dto: data, verificationRequest, user };
  }

  async validateResendVerification(
    data: ResendVerificationDto & { language: string },
  ): Promise<{ dto: ResendVerificationDto; user: UserEntity }> {
    const schema = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
          'string.email': translate(this.i18n, 'validation.email.invalid', data.language),
          'any.required': translate(this.i18n, 'validation.email.required', data.language),
        }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (user.emailVerifiedAt) {
      const message = translate(this.i18n, 'validation.emailAlreadyVerified', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.EMAIL_ALREADY_VERIFIED);
    }

    return { dto: data, user };
  }

  async validateMfaChallenge(
    data: MfaChallengeDto & { language: string },
  ): Promise<{ dto: MfaChallengeDto; session: any; user: UserEntity }> {
    const schema = Joi.object({
      code: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
          'string.length': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'string.pattern.base': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'any.required': translate(this.i18n, 'validation.invalidTotpCode', data.language),
        }),
      sessionToken: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.mfaSessionNotFound', data.language),
      }),
      rememberMe: Joi.boolean().optional(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const session = await this.mfaChallengeSessionRepository.findMfaSessionByToken(data.sessionToken);
    if (!session) {
      const message = translate(this.i18n, 'validation.mfaSessionNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.MFA_SESSION_NOT_FOUND);
    }

    if (session.status === MfaChallengeSessionStatus.expired || session.expiresAt < new Date()) {
      const message = translate(this.i18n, 'validation.mfaSessionExpired', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.MFA_SESSION_EXPIRED);
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (!user.totpEnabled) {
      const message = translate(this.i18n, 'validation.totpNotEnabled', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_NOT_ENABLED);
    }

    if (!user.totpSecret) {
      const message = translate(this.i18n, 'validation.totpSetupNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_SETUP_NOT_FOUND);
    }

    const isValidTotp = verifyTotpCode(user.totpSecret, data.code);
    if (!isValidTotp) {
      const message = translate(this.i18n, 'validation.invalidTotpCode', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOTP_CODE);
    }

    return { dto: data, session, user };
  }

  async validateMfaVerify(
    userId: number,
    data: MfaVerifyDto & { language: string },
  ): Promise<{ dto: MfaVerifyDto; user: UserEntity }> {
    const schema = Joi.object({
      code: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
          'string.length': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'string.pattern.base': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'any.required': translate(this.i18n, 'validation.invalidTotpCode', data.language),
        }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (user.totpEnabled) {
      const message = translate(this.i18n, 'validation.totpAlreadyEnabled', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_ALREADY_ENABLED);
    }

    if (!user.totpSecret) {
      const message = translate(this.i18n, 'validation.totpSetupNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_SETUP_NOT_FOUND);
    }

    const isValid = verifyTotpCode(user.totpSecret, data.code);
    if (!isValid) {
      const message = translate(this.i18n, 'validation.invalidTotpCode', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOTP_CODE);
    }

    return { dto: data, user };
  }

  async validateMfaBackupCodeConsume(
    data: MfaBackupCodeConsumeDto & { language: string },
  ): Promise<{ dto: MfaBackupCodeConsumeDto; session: any; user: UserEntity; matchingCode: any }> {
    const schema = Joi.object({
      code: Joi.string()
        .length(8)
        .pattern(/^[A-Z0-9]{8}$/)
        .required()
        .messages({
          'string.length': translate(this.i18n, 'validation.invalidBackupCode', data.language),
          'string.pattern.base': translate(this.i18n, 'validation.invalidBackupCode', data.language),
          'any.required': translate(this.i18n, 'validation.invalidBackupCode', data.language),
        }),
      sessionToken: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.mfaSessionNotFound', data.language),
      }),
      rememberMe: Joi.boolean().optional(),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const session = await this.mfaChallengeSessionRepository.findMfaSessionByToken(data.sessionToken);
    if (!session) {
      const message = translate(this.i18n, 'validation.mfaSessionNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.MFA_SESSION_NOT_FOUND);
    }

    if (session.status === MfaChallengeSessionStatus.expired || session.expiresAt < new Date()) {
      const message = translate(this.i18n, 'validation.mfaSessionExpired', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.MFA_SESSION_EXPIRED);
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    const backupCodes = await this.backupCodeRepository.findByUserId(session.userId);
    const hashedCode = hashBackupCode(data.code);
    const matchingCode = backupCodes.find((code) => !code.used && code.code === hashedCode);
    if (!matchingCode) {
      const message = translate(this.i18n, 'validation.backupCodeNotFound', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.BACKUP_CODE_NOT_FOUND);
    }

    return { dto: data, session, user, matchingCode };
  }

  async validateMfaDisable(
    userId: number,
    data: MfaDisableDto & { language: string },
  ): Promise<{ dto: MfaDisableDto; user: UserEntity }> {
    const schema = Joi.object({
      code: Joi.string()
        .min(6)
        .max(8)
        .pattern(/^[A-Z0-9]{6,8}$/)
        .required()
        .messages({
          'string.min': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'string.max': translate(this.i18n, 'validation.invalidBackupCode', data.language),
          'string.pattern.base': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'any.required': translate(this.i18n, 'validation.invalidTotpCode', data.language),
        }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (!user.totpEnabled || !user.totpSecret) {
      const message = translate(this.i18n, 'validation.totpNotEnabled', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_NOT_ENABLED);
    }

    if (data.code.length === 6) {
      const isValid = verifyTotpCode(user.totpSecret, data.code);
      if (!isValid) {
        const message = translate(this.i18n, 'validation.invalidTotpCode', data.language);
        throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOTP_CODE);
      }
    } else if (data.code.length === 8) {
      const backupCodes = await this.backupCodeRepository.findByUserId(userId);
      const hashedCode = hashBackupCode(data.code);
      const matchingCode = backupCodes.find((code) => !code.used && code.code === hashedCode);
      if (!matchingCode) {
        const message = translate(this.i18n, 'validation.backupCodeNotFound', data.language);
        throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.BACKUP_CODE_NOT_FOUND);
      }
    }

    return { dto: data, user };
  }

  async validateMfaRegenerateBackupCodes(
    userId: number,
    data: MfaRegenerateBackupCodesDto & { language: string },
  ): Promise<{ dto: MfaRegenerateBackupCodesDto; user: UserEntity }> {
    const schema = Joi.object({
      code: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
          'string.length': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'string.pattern.base': translate(this.i18n, 'validation.invalidTotpCode', data.language),
          'any.required': translate(this.i18n, 'validation.invalidTotpCode', data.language),
        }),
      language: Joi.string()
        .valid(...config.i18n.supportedLanguages)
        .default(config.defaultLanguage)
        .messages({
          'any.only': translate(this.i18n, 'validation.language.invalid', data.language),
        }),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (!user.totpEnabled || !user.totpSecret) {
      const message = translate(this.i18n, 'validation.totpNotEnabled', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_NOT_ENABLED);
    }

    const isValid = verifyTotpCode(user.totpSecret, data.code);
    if (!isValid) {
      const message = translate(this.i18n, 'validation.invalidTotpCode', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOTP_CODE);
    }

    return { dto: data, user };
  }

  async validateSetupMfa(
    userId: number,
    data: { language: string },
  ): Promise<{ user: UserEntity }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (user.totpEnabled) {
      const message = translate(this.i18n, 'validation.totpAlreadyEnabled', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_ALREADY_ENABLED);
    }

    return { user };
  }

  async validateGetBackupCodes(
    userId: number,
    data: { language: string },
  ): Promise<{ user: UserEntity }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      const message = translate(this.i18n, 'validation.userNotFound', data.language);
      throwError(message, HttpStatus.NOT_FOUND, ErrorCode.USER_NOT_FOUND);
    }

    if (!user.totpEnabled) {
      const message = translate(this.i18n, 'validation.totpNotEnabled', data.language);
      throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.TOTP_NOT_ENABLED);
    }

    return { user };
  }

  async validateFreePlanExists(language: string = 'en'): Promise<{ planId: number }> {
    const freePlan = await this.planRepository.findFreePlan();
    if (!freePlan) {
      const message = translate(this.i18n, 'errors.freePlanNotFound', language);
      throwError(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.SERVER_ERROR);
    }
    return { planId: freePlan.id };
  }
}

