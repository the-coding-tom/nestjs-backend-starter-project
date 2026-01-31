import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { JwtService } from '@nestjs/jwt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { UserRepository } from '../../repositories/user.repository';
import { SessionRepository } from '../../repositories/session.repository';
import { OAuthAccountRepository } from '../../repositories/oauth-account.repository';
import { LocalAuthAccountRepository } from '../../repositories/local-auth-account.repository';
import { VerificationRequestRepository } from '../../repositories/verification-request.repository';
import { BackupCodeRepository } from '../../repositories/backup-code.repository';
import { MfaChallengeSessionRepository } from '../../repositories/mfa-challenge-session.repository';
import { AuthValidator } from './auth.validator';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { hashPassword } from '../../utils/password.util';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/config';
import * as moment from 'moment';
import { OAuthProvider, UserStatus, UserType } from '../../common/enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';
import {
  LoginDto,
  LoginResponseDto,
  OAuthCallbackDto,
  OAuthLoginResponseDto,
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
  TotpSetupResponseDto,
  TotpVerifySetupResponseDto,
  BackupCodesResponseDto,
  RegenerateBackupCodesResponseDto,
} from './dto/auth.dto';
import { VerificationRequestType, MfaMethod, MfaChallengeSessionStatus, SubscriptionStatus, BillingInterval } from '@prisma/client';
import { generateBackupCodes, hashBackupCode } from '../../utils/backup-code.util';
import { generateSessionToken } from '../../utils/token.util';
import { CreateMfaChallengeSessionData, UpdateMfaChallengeSessionData } from '../../repositories/entities/mfa-session.entity';
import { generateSlug } from '../../utils/slug.util';
import {
  CreateUserWithWorkspaceAndSubscriptionData,
  CreateOAuthUserWithWorkspaceAndSubscriptionData,
} from '../../repositories/entities/user-onboarding.entity';
import { JwtPayload } from '../../common/entities/auth.entity';
import { OAuthUserInfo } from '../../common/entities/oauth.entity';
import { TotpSetupResult } from '../../common/entities/mfa.entity';
import { EmailService } from '../../common/services/email/email.service';

// Internal types for token generation
interface TokenUser {
  id: number;
  email: string;
  type: string;
  status: string;
  emailVerifiedAt: Date | null;
}

interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Internal type for GitHub email response
interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Handles authentication: login, register, OAuth (Google/GitHub), password reset, email verification, and MFA (TOTP, backup codes).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly oauthAccountRepository: OAuthAccountRepository,
    private readonly localAuthAccountRepository: LocalAuthAccountRepository,
    private readonly verificationRequestRepository: VerificationRequestRepository,
    private readonly backupCodeRepository: BackupCodeRepository,
    private readonly mfaChallengeSessionRepository: MfaChallengeSessionRepository,
    private readonly authValidator: AuthValidator,
    private readonly i18n: I18nService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) { }

  /**
   * Login with email and password; returns tokens or requires MFA.
   * @param loginDto - Email and password
   * @param request - API request (language, user-agent, ip)
   * @returns Success response with tokens or MFA required, or error response
   */
  async login(loginDto: LoginDto, request: ApiRequest): Promise<any> {
    try {
      const { dto, user } = await this.authValidator.validateLogin({ ...loginDto, language: request.language });

      if (user.totpEnabled) {
        const sessionToken = generateSessionToken();

        const sessionData: CreateMfaChallengeSessionData = {
          userId: user.id,
          email: user.email,
          mfaMethod: MfaMethod.TOTP,
          sessionToken: sessionToken,
          expiresAt: moment().add(10, 'minutes').toDate(),
          status: MfaChallengeSessionStatus.pending,
        };
        await this.mfaChallengeSessionRepository.create(sessionData);

        return generateSuccessResponse({
          statusCode: HttpStatus.OK,
          message: translate(this.i18n, 'auth.requiresTwoFactor', request.language),
          data: {
            requiresTwoFactor: true,
            sessionToken,
          },
        });
      }

      // Generate tokens
      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user);

      const rememberMe = !!dto.rememberMe;

      await this.sessionRepository.createSession({
        userId: user.id,
        token: refreshToken,
        expiresAt: this.getSessionExpiryDate(rememberMe),
        rememberMe: rememberMe,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: request.ip || 'unknown',
      });

      const response: LoginResponseDto = {
        accessToken,
        refreshToken,
        expiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          photoUrl: user.photoUrl,
          isEmailVerified: !!user.emailVerifiedAt,
          status: user.status,
        },
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.login.success', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`Login failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Register new user with workspace and subscription; sends verification email unless invited.
   * @param registerDto - Email, password, name, optional plan/invitation
   * @param request - API request (language, etc.)
   * @returns Success response with user/tokens or error response
   */
  async register(registerDto: RegisterDto, request: ApiRequest): Promise<any> {
    try {
      const { dto, invitedUser } = await this.authValidator.validateRegister({ ...registerDto, language: request.language });

      const hashedPassword = await hashPassword(dto.password);

      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpiresAt = moment().add(24, 'hours').toDate();

      const workspaceName = `${dto.name || dto.email.split('@')[0]}`;
      const baseSlug = generateSlug(workspaceName);

      const onboardingData: CreateUserWithWorkspaceAndSubscriptionData = {
        email: dto.email,
        name: dto.name,
        firstName: null,
        lastName: null,
        photoUrl: null,
        timezone: config.defaultTimezone,
        language: config.defaultLanguage,
        status: invitedUser ? UserStatus.ACTIVE : UserStatus.INACTIVE,
        type: UserType.CUSTOMER,
        emailVerifiedAt: invitedUser ? new Date() : null,
        passwordHash: hashedPassword,
        verificationRequest: invitedUser ? undefined : {
          token: emailVerificationToken,
          type: VerificationRequestType.EMAIL_VERIFICATION,
          expiresAt: emailVerificationExpiresAt,
        },
        workspaceName,
        slug: baseSlug,
        planId: dto.planId,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTHLY,
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
      };

      let user;
      if (invitedUser) {
        user = await this.userRepository.activateShadowUserWithWorkspaceAndSubscription(invitedUser.id, onboardingData);
      } else {
        user = await this.userRepository.createUserWithWorkspaceAndSubscription(onboardingData);

        await this.emailService.sendEmailVerification(
          user.email,
          request.language,
          {
            token: emailVerificationToken,
          }
        );
      }

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.register.success', request.language),
        data: {
          email: user.email,
          verificationRequired: !invitedUser,
        },
      });
    } catch (error) {
      LoggerService.error(`Registration failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Returns Google OAuth URL for client redirect.
   * @param request - API request (language, etc.)
   * @returns Success response with OAuth URL or error response
   */
  async getGoogleOAuthUrl(request: ApiRequest): Promise<any> {
    try {
      const googleClient = new OAuth2Client(
        config.oauth.google.clientId,
        config.oauth.google.clientSecret,
        config.oauth.redirectUri,
      );

      const oauthUrl = googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        redirect_uri: config.oauth.redirectUri,
        state: randomBytes(32).toString('hex'),
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.oauth.url.success', request.language),
        data: {
          provider: OAuthProvider.GOOGLE,
          url: oauthUrl,
        },
      });
    } catch (error) {
      LoggerService.error(`Failed to generate Google OAuth URL: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * OAuth callback from Google; exchanges code for tokens and creates/links user.
   * @param callbackDto - Code and state from Google
   * @param request - API request (language, user-agent, ip)
   * @returns Success response with tokens and user or error response
   */
  async handleGoogleCallback(callbackDto: OAuthCallbackDto, request: ApiRequest): Promise<any> {
    try {
      const { dto } = await this.authValidator.validateOAuthCallback({ ...callbackDto, language: request.language });

      const googleClient = new OAuth2Client(
        config.oauth.google.clientId,
        config.oauth.google.clientSecret,
        config.oauth.redirectUri,
      );

      const { tokens } = await googleClient.getToken({
        code: dto.code!,
        redirect_uri: config.oauth.redirectUri,
      });

      if (!tokens.access_token) {
        throw new Error('Failed to exchange code for Google token');
      }

      const oauthUserInfo = await this.verifyGoogleToken(tokens.access_token!);

      let oauthAccount = await this.oauthAccountRepository.findByProviderAndProviderUserId(
        OAuthProvider.GOOGLE,
        oauthUserInfo.id,
      );
      let user = oauthAccount?.User || null;

      if (!user) {
        user = await this.userRepository.findByEmail(oauthUserInfo.email);

        if (user) {
          // Link existing user to OAuth provider
          await this.oauthAccountRepository.create({
            userId: user.id,
            provider: OAuthProvider.GOOGLE,
            providerUserId: oauthUserInfo.id,
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
            metadata: {
              name: oauthUserInfo.name,
              picture: oauthUserInfo.picture,
            },
          });
        } else {
          // Validate FREE plan exists
          const { planId } = await this.authValidator.validateFreePlanExists(request.language);

          // Create workspace name and slug
          const workspaceName = `${oauthUserInfo.name || oauthUserInfo.email.split('@')[0]}'s Workspace`;
          const baseSlug = generateSlug(workspaceName);

          // Create OAuth user with workspace and subscription using repository transaction
          const onboardingData: CreateOAuthUserWithWorkspaceAndSubscriptionData = {
            email: oauthUserInfo.email,
            name: oauthUserInfo.name,
            firstName: oauthUserInfo.firstName,
            lastName: oauthUserInfo.lastName,
            photoUrl: oauthUserInfo.picture,
            timezone: config.defaultTimezone,
            language: config.defaultLanguage,
            status: UserStatus.ACTIVE,
            type: UserType.CUSTOMER,
            emailVerifiedAt: new Date(),
            oauthProvider: OAuthProvider.GOOGLE,
            oauthProviderUserId: oauthUserInfo.id,
            oauthAccessToken: tokens.access_token!,
            oauthRefreshToken: tokens.refresh_token,
            oauthExpiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
            oauthMetadata: {
              name: oauthUserInfo.name,
              picture: oauthUserInfo.picture,
            },
            workspaceName,
            slug: baseSlug,
            planId,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            billingInterval: BillingInterval.MONTHLY,
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
          };

          user = await this.userRepository.createOAuthUserWithWorkspaceAndSubscription(onboardingData);
        }
      } else {
        // Update OAuth access token
        await this.oauthAccountRepository.update(oauthAccount!.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        });
      }

      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user);

      await this.sessionRepository.createSession({
        userId: user.id,
        token: refreshToken,
        expiresAt: this.getSessionExpiryDate(true),
        rememberMe: true,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: request.ip || 'unknown',
      });

      const response: OAuthLoginResponseDto = {
        accessToken,
        refreshToken,
        expiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          photoUrl: user.photoUrl || undefined,
          isEmailVerified: !!user.emailVerifiedAt,
          status: user.status,
        },
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.oauth.callback.success', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`Google OAuth callback failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Returns GitHub OAuth URL for client redirect.
   * @param request - API request (language, etc.)
   * @returns Success response with OAuth URL or error response
   */
  async getGitHubOAuthUrl(request: ApiRequest): Promise<any> {
    try {
      const githubOAuthUrl = new URL(config.oauth.github.authUrl!);
      githubOAuthUrl.searchParams.set('client_id', config.oauth.github.clientId!);
      githubOAuthUrl.searchParams.set('redirect_uri', config.oauth.redirectUri!);
      githubOAuthUrl.searchParams.set('scope', 'read:user user:email');
      githubOAuthUrl.searchParams.set('state', randomBytes(32).toString('hex'));
      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.oauth.url.success', request.language),
        data: {
          provider: OAuthProvider.GITHUB,
          url: githubOAuthUrl.toString(),
        },
      });
    } catch (error) {
      LoggerService.error(`Failed to generate GitHub OAuth URL: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * OAuth callback from GitHub; exchanges code for tokens and creates/links user.
   * @param callbackDto - Code and state from GitHub
   * @param request - API request (language, user-agent, ip)
   * @returns Success response with tokens and user or error response
   */
  async handleGitHubCallback(callbackDto: OAuthCallbackDto, request: ApiRequest): Promise<any> {
    try {
      const { dto } = await this.authValidator.validateOAuthCallback({ ...callbackDto, language: request.language });

      // Exchange code for GitHub token
      const tokenResponse = await fetch(config.oauth.github.tokenUrl!, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.oauth.github.clientId,
          client_secret: config.oauth.github.clientSecret,
          code: dto.code,
          redirect_uri: config.oauth.redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        throw new Error('Failed to exchange code for GitHub token');
      }

      const oauthUserInfo = await this.verifyGitHubToken(tokenData.access_token);

      let oauthAccount = await this.oauthAccountRepository.findByProviderAndProviderUserId(
        OAuthProvider.GITHUB,
        oauthUserInfo.id,
      );
      let user = oauthAccount?.User || null;

      if (!user) {
        user = await this.userRepository.findByEmail(oauthUserInfo.email);

        if (user) {
          await this.oauthAccountRepository.create({
            userId: user.id,
            provider: OAuthProvider.GITHUB,
            providerUserId: oauthUserInfo.id,
            accessToken: tokenData.access_token,
          });
        } else {
          // Validate FREE plan exists
          const { planId } = await this.authValidator.validateFreePlanExists(request.language);

          // Create workspace name and slug
          const workspaceName = `${oauthUserInfo.name || oauthUserInfo.email.split('@')[0]}'s Workspace`;
          const baseSlug = generateSlug(workspaceName);

          // Create OAuth user with workspace and subscription using repository transaction
          const onboardingData: CreateOAuthUserWithWorkspaceAndSubscriptionData = {
            email: oauthUserInfo.email,
            name: oauthUserInfo.name,
            firstName: oauthUserInfo.firstName,
            lastName: oauthUserInfo.lastName,
            photoUrl: oauthUserInfo.picture,
            timezone: config.defaultTimezone,
            language: config.defaultLanguage,
            status: UserStatus.ACTIVE,
            type: UserType.CUSTOMER,
            emailVerifiedAt: new Date(),
            oauthProvider: OAuthProvider.GITHUB,
            oauthProviderUserId: oauthUserInfo.id,
            oauthAccessToken: tokenData.access_token,
            oauthRefreshToken: null,
            oauthExpiresAt: undefined,
            oauthMetadata: null,
            workspaceName,
            slug: baseSlug,
            planId,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            billingInterval: BillingInterval.MONTHLY,
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
          };

          user = await this.userRepository.createOAuthUserWithWorkspaceAndSubscription(onboardingData);
        }
      } else {
        await this.oauthAccountRepository.update(oauthAccount!.id, {
          accessToken: tokenData.access_token,
        });
      }

      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user);

      await this.sessionRepository.createSession({
        userId: user.id,
        token: refreshToken,
        expiresAt: this.getSessionExpiryDate(true),
        rememberMe: true,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: request.ip || 'unknown',
      });

      const response: OAuthLoginResponseDto = {
        accessToken,
        refreshToken,
        expiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          photoUrl: user.photoUrl || undefined,
          isEmailVerified: !!user.emailVerifiedAt,
          status: user.status,
        },
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.oauth.callback.success', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`GitHub OAuth callback failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Invalidate refresh token (logout).
   * @param logoutDto - Refresh token to invalidate
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async logout(logoutDto: LogoutDto, request: ApiRequest): Promise<any> {
    try {
      await this.authValidator.validateLogout({ ...logoutDto, language: request.language });
      await this.sessionRepository.deleteSessionByRefreshToken(logoutDto.refreshToken);
      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.logout.success', request.language),
      });
    } catch (error) {
      LoggerService.error(`Logout failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Issue new access and refresh tokens from valid refresh token.
   * @param refreshTokenDto - Refresh token
   * @param request - API request (language, user-agent, ip)
   * @returns Success response with new tokens or error response
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto, request: ApiRequest): Promise<any> {
    try {
      const { user, session } = await this.authValidator.validateRefreshToken({ ...refreshTokenDto, language: request.language });

      await this.sessionRepository.deleteSessionByRefreshToken(refreshTokenDto.refreshToken);

      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user);

      await this.sessionRepository.createSession({
        userId: user.id,
        token: refreshToken,
        expiresAt: this.getSessionExpiryDate(session.rememberMe),
        rememberMe: session.rememberMe,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: request.ip || 'unknown',
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.refresh.success', request.language),
        data: {
          accessToken,
          refreshToken,
          expiresIn,
        },
      });
    } catch (error) {
      LoggerService.error(`Token refresh failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Request password reset; sends email with reset link if user exists (same response either way).
   * @param resetPasswordRequestDto - Email
   * @param request - API request (language, etc.)
   * @returns Success response (same message whether user exists or not) or error response
   */
  async requestPasswordReset(
    resetPasswordRequestDto: ResetPasswordRequestDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { user } = await this.authValidator.validateResetPasswordRequest({
        ...resetPasswordRequestDto,
        language: request.language,
      });

      if (user) {
        await this.verificationRequestRepository.deleteByUserIdAndType(
          user.id,
          VerificationRequestType.PASSWORD_RESET,
        );

        const resetToken = uuidv4();

        await this.verificationRequestRepository.create({
          userId: user.id,
          email: user.email,
          token: resetToken,
          type: VerificationRequestType.PASSWORD_RESET,
          expiresAt: moment().add(1, 'hour').toDate(),
        });

        await this.emailService.sendPasswordReset(
          user.email,
          request.language,
          {
            token: resetToken,
          }
        );
      }

      // Same response whether user exists or not, to prevent email enumeration.
      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.password.reset.requested', request.language),
      });
    } catch (error) {
      LoggerService.error(`Password reset request failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Set new password using token from reset email.
   * @param resetPasswordConfirmDto - Token and new password
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async confirmPasswordReset(
    resetPasswordConfirmDto: ResetPasswordConfirmDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { verificationRequest, user } =
        await this.authValidator.validateResetPasswordConfirm({
          ...resetPasswordConfirmDto,
          language: request.language,
        });

      const hashedPassword = await hashPassword(resetPasswordConfirmDto.newPassword);

      if (user.localAuthAccount) {
        await this.localAuthAccountRepository.updatePassword(user.id, hashedPassword);
      } else {
        await this.localAuthAccountRepository.create(user.id, hashedPassword);
      }

      await this.verificationRequestRepository.deleteByToken(verificationRequest.token);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.password.reset.success', request.language),
      });
    } catch (error) {
      LoggerService.error(`Password reset confirmation failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Change password for authenticated user with local auth account.
   * @param changePasswordDto - Current and new password
   * @param request - API request (user context from JWT)
   * @returns Success response or error response
   */
  async changePassword(changePasswordDto: ChangePasswordDto, request: ApiRequest): Promise<any> {
    try {
      await this.authValidator.validateChangePassword(
        { ...changePasswordDto, language: request.language },
        request.user!.id,
      );

      const hashedPassword = await hashPassword(changePasswordDto.newPassword);
      await this.localAuthAccountRepository.updatePassword(request.user!.id, hashedPassword);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.password.changed', request.language),
      });
    } catch (error) {
      LoggerService.error(`Change password failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Confirm email using token from verification link; activates user and sends welcome email.
   * @param verifyEmailDto - Token from verification link
   * @param request - API request (language, etc.)
   * @returns Success response with email verified flag or error response
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto, request: ApiRequest): Promise<any> {
    try {
      const { verificationRequest, user } = await this.authValidator.validateVerifyEmail({
        ...verifyEmailDto,
        language: request.language,
      });

      await this.userRepository.update(user.id, {
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      });

      await this.verificationRequestRepository.deleteByToken(verificationRequest.token);

      await this.emailService.sendWelcome(
        user.email,
        request.language
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.email.verify.success', request.language),
        data: {
          email: user.email,
          isEmailVerified: true,
        },
      });
    } catch (error) {
      LoggerService.error(`Email verification failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Resend email verification link.
   * @param resendVerificationDto - Email
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async resendVerification(resendVerificationDto: ResendVerificationDto, request: ApiRequest): Promise<any> {
    try {
      const { user } = await this.authValidator.validateResendVerification({
        ...resendVerificationDto,
        language: request.language,
      });

      await this.verificationRequestRepository.deleteByUserIdAndType(
        user.id,
        VerificationRequestType.EMAIL_VERIFICATION,
      );

      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpiresAt = moment().add(24, 'hours').toDate();

      await this.verificationRequestRepository.create({
        userId: user.id,
        email: user.email,
        token: verificationToken,
        type: VerificationRequestType.EMAIL_VERIFICATION,
        expiresAt: verificationExpiresAt,
      });

      await this.emailService.sendEmailVerification(
        user.email,
        request.language,
        {
          token: verificationToken,
        }
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.email.verification.sent', request.language),
        data: {
          email: user.email,
        },
      });
    } catch (error) {
      LoggerService.error(`Resend verification failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Start TOTP setup; returns QR code and manual entry key.
   * @param userId - User ID
   * @param request - API request (language, etc.)
   * @returns Success response with qrCode and secret or error response
   */
  async setupMfa(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { user } = await this.authValidator.validateSetupMfa(userId, {
        language: request.language,
      });

      const { secret, qrCode, manualEntryKey } = await this.setupTotp(user.email);

      await this.userRepository.update(userId, {
        totpSecret: secret,
      });

      const response: TotpSetupResponseDto = {
        qrCode,
        manualEntryKey,
        issuer: config.mfa.issuer,
        accountName: user.email,
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.setup.success', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`Error setting up TOTP: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Confirm TOTP with code and enable MFA; returns backup codes (shown once).
   * @param userId - User ID
   * @param mfaVerifyDto - TOTP code
   * @param request - API request (language, etc.)
   * @returns Success response with backup codes or error response
   */
  async verifyMfa(userId: number, mfaVerifyDto: MfaVerifyDto, request: ApiRequest): Promise<any> {
    try {
      await this.authValidator.validateMfaVerify(userId, {
        ...mfaVerifyDto,
        language: request.language,
      });

      const backupCodes = generateBackupCodes(10);
      const hashedCodes = backupCodes.map((code) => hashBackupCode(code));

      await this.backupCodeRepository.createBackupCodes(userId, hashedCodes);

      await this.userRepository.update(userId, {
        totpEnabled: true,
      });

      const response: TotpVerifySetupResponseDto = {
        backupCodes,
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.verify.success', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`Error verifying TOTP setup: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Complete MFA challenge (TOTP or backup code) after login; returns tokens.
   * @param mfaChallengeDto - MFA code (TOTP or backup code)
   * @param request - API request (language, user-agent, ip)
   * @returns Success response with tokens and user or error response
   */
  async challengeMfa(mfaChallengeDto: MfaChallengeDto, request: ApiRequest): Promise<any> {
    try {
      const { dto, user, session } = await this.authValidator.validateMfaChallenge({
        ...mfaChallengeDto,
        language: request.language,
      });

      const updateData: UpdateMfaChallengeSessionData = {
        status: MfaChallengeSessionStatus.verified,
      };
      await this.mfaChallengeSessionRepository.update(session.id, updateData);

      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user);

      const rememberMe = !!dto.rememberMe;

      await this.sessionRepository.createSession({
        userId: user.id,
        token: refreshToken,
        expiresAt: this.getSessionExpiryDate(rememberMe),
        rememberMe,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: request.ip || 'unknown',
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.challenge.success', request.language),
        data: {
          accessToken,
          refreshToken,
          expiresIn,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            photoUrl: user.photoUrl,
            isEmailVerified: !!user.emailVerifiedAt,
            status: user.status,
          },
        },
      });
    } catch (error) {
      LoggerService.error(`MFA challenge failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Return count of remaining backup codes (codes themselves are not returned).
   * @param userId - User ID
   * @param request - API request (language, etc.)
   * @returns Success response with remainingCount or error response
   */
  async getBackupCodes(userId: number, request: ApiRequest): Promise<any> {
    try {
      await this.authValidator.validateGetBackupCodes(userId, {
        language: request.language,
      });

      const backupCodes = await this.backupCodeRepository.findByUserId(userId);
      const unusedCodes = backupCodes.filter((code) => !code.used);

      // Codes are stored as hashes and shown only once at generation; we never return them again.
      const response: BackupCodesResponseDto = {
        remainingCount: unusedCodes.length,
        codes: [],
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.backupCodes.get.success', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`Error retrieving backup codes: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Use a backup code to complete MFA challenge; returns tokens.
   * @param mfaBackupCodeConsumeDto - Backup code
   * @param request - API request (language, user-agent, ip)
   * @returns Success response with tokens and user or error response
   */
  async consumeBackupCode(mfaBackupCodeConsumeDto: MfaBackupCodeConsumeDto, request: ApiRequest): Promise<any> {
    try {
      const { dto, user, session, matchingCode } = await this.authValidator.validateMfaBackupCodeConsume({
        ...mfaBackupCodeConsumeDto,
        language: request.language,
      });

      await this.backupCodeRepository.markAsUsed(matchingCode.id);

      const updateData: UpdateMfaChallengeSessionData = {
        status: MfaChallengeSessionStatus.verified,
      };
      await this.mfaChallengeSessionRepository.update(session.id, updateData);

      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user);

      const rememberMe = !!dto.rememberMe;

      await this.sessionRepository.createSession({
        userId: user.id,
        token: refreshToken,
        expiresAt: this.getSessionExpiryDate(rememberMe),
        rememberMe,
        userAgent: request.headers['user-agent'] || 'unknown',
        ipAddress: request.ip || 'unknown',
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.challenge.success', request.language),
        data: {
          accessToken,
          refreshToken,
          expiresIn,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            photoUrl: user.photoUrl,
            isEmailVerified: !!user.emailVerifiedAt,
            status: user.status,
          },
        },
      });
    } catch (error) {
      LoggerService.error(`Backup code consumption failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Disable MFA for user (requires current TOTP or backup code).
   * @param userId - User ID
   * @param mfaDisableDto - TOTP code or backup code for verification
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async disableMfa(userId: number, mfaDisableDto: MfaDisableDto, request: ApiRequest): Promise<any> {
    try {
      await this.authValidator.validateMfaDisable(userId, {
        ...mfaDisableDto,
        language: request.language,
      });

      await this.userRepository.update(userId, {
        totpSecret: null,
        totpEnabled: false,
      });

      await this.backupCodeRepository.deleteByUserId(userId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.disable.success', request.language),
      });
    } catch (error) {
      LoggerService.error(`Error disabling MFA: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Generate new backup codes (invalidates previous ones); returns codes (shown once).
   * @param userId - User ID
   * @param mfaRegenerateBackupCodesDto - TOTP code for verification
   * @param request - API request (language, etc.)
   * @returns Success response with backup codes or error response
   */
  async regenerateBackupCodes(
    userId: number,
    mfaRegenerateBackupCodesDto: MfaRegenerateBackupCodesDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      await this.authValidator.validateMfaRegenerateBackupCodes(userId, {
        ...mfaRegenerateBackupCodesDto,
        language: request.language,
      });

      await this.backupCodeRepository.deleteByUserId(userId);

      const backupCodes = generateBackupCodes(10);
      const hashedCodes = backupCodes.map((code) => hashBackupCode(code));

      await this.backupCodeRepository.createBackupCodes(userId, hashedCodes);

      const response: RegenerateBackupCodesResponseDto = {
        backupCodes,
      };

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'auth.mfa.backupCodes.regenerated', request.language),
        data: response,
      });
    } catch (error) {
      LoggerService.error(`Error regenerating backup codes: ${error}`);
      return generateErrorResponse(error);
    }
  }

  // ============================================
  // Private Methods - Session Expiry
  // ============================================

  private getSessionExpiryDate(rememberMe: boolean): Date {
    const days = rememberMe ? config.sessionExpiry.rememberMeDays : config.sessionExpiry.defaultDays;
    return moment().add(days, 'days').toDate();
  }

  // ============================================
  // Private Methods - JWT Token Generation
  // ============================================

  /**
   * Generate access and refresh tokens for a user
   */
  private generateTokens(user: TokenUser): GeneratedTokens {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userType: user.type,
      status: user.status,
      isEmailVerified: !!user.emailVerifiedAt,
    };

    const refreshPayload: JwtPayload & { type: string } = {
      ...accessPayload,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: config.authJWTSecret,
      expiresIn: config.tokenExpirationInSeconds,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: config.authRefreshJWTSecret,
      expiresIn: config.refreshTokenExpirationInSeconds,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.tokenExpirationInSeconds,
    };
  }

  // ============================================
  // Private Methods - OAuth Token Verification
  // ============================================

  /**
   * Verify Google OAuth token and get user info
   */
  private async verifyGoogleToken(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch user info from Google');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      name: data.name || `${data.given_name} ${data.family_name}`.trim(),
      firstName: data.given_name,
      lastName: data.family_name,
      picture: data.picture,
      provider: 'google',
    };
  }

  /**
   * Verify GitHub OAuth token and get user info
   */
  private async verifyGitHubToken(accessToken: string): Promise<OAuthUserInfo> {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'App/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      throw new BadRequestException('Invalid GitHub token');
    }

    const userData = await userResponse.json();

    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'App/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!emailResponse.ok) {
      throw new BadRequestException(
        'Unable to access email from GitHub. Please ensure the "user:email" scope is granted.',
      );
    }

    const emails: GitHubEmail[] = await emailResponse.json();

    const primaryEmail = emails.find((email) => email.primary && email.verified);

    if (!primaryEmail) {
      throw new BadRequestException(
        'No primary verified email found on your GitHub account.',
      );
    }

    const nameParts = userData.name?.split(' ') || [];

    return {
      id: userData.id.toString(),
      email: primaryEmail.email,
      name: userData.name || userData.login,
      firstName: nameParts[0] || userData.login,
      lastName: nameParts.slice(1).join(' ') || '',
      picture: userData.avatar_url,
      provider: 'github',
    };
  }

  // ============================================
  // Private Methods - MFA Setup
  // ============================================

  /**
   * Set up TOTP for a user - generates secret and QR code
   */
  private async setupTotp(userEmail: string): Promise<TotpSetupResult> {
    const secret = speakeasy.generateSecret({
      name: `${config.mfa.issuer}:${userEmail}`,
      issuer: config.mfa.issuer,
      length: 32,
    });

    const qrCode = await this.generateQrCode(secret.base32!, userEmail);

    return {
      secret: secret.base32!,
      qrCode,
      manualEntryKey: secret.base32!,
    };
  }

  /**
   * Generate a QR code for TOTP setup
   */
  private async generateQrCode(secret: string, userEmail: string): Promise<string> {
    const otpAuthUrl = speakeasy.otpauthURL({
      secret,
      label: `${config.mfa.issuer}:${userEmail}`,
      issuer: config.mfa.issuer,
      encoding: 'base32',
    });

    return QRCode.toDataURL(otpAuthUrl);
  }
}

