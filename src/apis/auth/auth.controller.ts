import { Controller, Post, Body, Req, Res, Get, Query } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ApiRequest } from '../../common/types/request.types';
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
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Login with email and password; returns tokens or requires MFA.
   * @param loginDto - Email and password
   * @param request - API request (sets cookies for refresh token)
   * @param response - Express response for status and body
   * @returns Response sent via response (tokens or MFA required)
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.login(loginDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Register new user with workspace and subscription; sends verification email unless invited.
   * @param registerDto - Email, password, name, optional workspace/invitation
   * @param request - API request (language, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (user/tokens or error)
   */
  @Post('signup')
  async signup(@Body() registerDto: RegisterDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.register(registerDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Invalidate refresh token (logout).
   * @param logoutDto - Optional refresh token (or from cookie)
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.logout(logoutDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Issue new access and refresh tokens from valid refresh token.
   * @param refreshTokenDto - Refresh token (or from cookie)
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (tokens or error)
   */
  @Post('refresh')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.refreshToken(
      refreshTokenDto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Request password reset; sends email with reset link if user exists (same response either way).
   * @param resetPasswordRequestDto - Email
   * @param request - API request (language, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (success message)
   */
  @Post('reset-password')
  async requestPasswordReset(
    @Body() resetPasswordRequestDto: ResetPasswordRequestDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.requestPasswordReset(
      resetPasswordRequestDto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Set new password using token from reset email.
   * @param resetPasswordConfirmDto - Token and new password
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('confirm-password-reset')
  async confirmPasswordReset(
    @Body() resetPasswordConfirmDto: ResetPasswordConfirmDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.confirmPasswordReset(
      resetPasswordConfirmDto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Confirm email using token from verification link; activates user and sends welcome email.
   * @param verifyEmailDto - Token from verification link
   * @param request - API request (language, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.verifyEmail(verifyEmailDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Resend email verification link.
   * @param resendVerificationDto - Email
   * @param request - API request (language, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('resend-verification')
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.resendVerification(
      resendVerificationDto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Redirect URL for Google OAuth; returns OAuth URL for client redirect.
   * @param request - API request (state, redirect_uri, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (OAuth URL)
   */
  @Get('google')
  async getGoogleOAuthUrl(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.getGoogleOAuthUrl(request);
    response.status(status).json(restOfResponse);
  }

  /**
   * OAuth callback from Google; exchanges code for tokens and creates/links user.
   * @param body - Code and state from frontend (extracted from OAuth redirect)
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (tokens and user or error)
   */
  @Post('google/callback')
  async handleGoogleCallback(
    @Body() body: OAuthCallbackDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.handleGoogleCallback(
      body,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Redirect URL for GitHub OAuth; returns OAuth URL for client redirect.
   * @param request - API request (state, redirect_uri, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (OAuth URL)
   */
  @Get('github')
  async getGitHubOAuthUrl(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.getGitHubOAuthUrl(request);
    response.status(status).json(restOfResponse);
  }

  /**
   * OAuth callback from GitHub; exchanges code for tokens and creates/links user.
   * @param body - Code and state from frontend (extracted from OAuth redirect)
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (tokens and user or error)
   */
  @Post('github/callback')
  async handleGitHubCallback(
    @Body() body: OAuthCallbackDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.handleGitHubCallback(
      body,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Start TOTP setup; returns QR code and manual entry key.
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (qrCode, secret)
   */
  @Post('mfa/setup')
  async setupMfa(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.setupMfa(request.user!.id, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Confirm TOTP with code and enable MFA; returns backup codes (shown once).
   * @param request - API request (user context)
   * @param mfaVerifyDto - TOTP code
   * @param response - Express response for status and body
   * @returns Response sent via response (backup codes)
   */
  @Post('mfa/verify')
  async verifyMfa(@Req() request: ApiRequest, @Body() mfaVerifyDto: MfaVerifyDto, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.verifyMfa(request.user!.id, mfaVerifyDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Complete MFA challenge (TOTP or backup code) after login; returns tokens.
   * @param mfaChallengeDto - MFA code (TOTP or backup code)
   * @param request - API request (pending MFA session)
   * @param response - Express response for status and body
   * @returns Response sent via response (tokens or error)
   */
  @Post('mfa/challenge')
  async challengeMfa(@Body() mfaChallengeDto: MfaChallengeDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.challengeMfa(mfaChallengeDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Return count of remaining backup codes (codes themselves are not returned).
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (count)
   */
  @Get('mfa/backup-codes')
  async getBackupCodes(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.getBackupCodes(request.user!.id, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Use a backup code to complete MFA challenge; returns tokens.
   * @param mfaBackupCodeConsumeDto - Backup code
   * @param request - API request (pending MFA session)
   * @param response - Express response for status and body
   * @returns Response sent via response (tokens or error)
   */
  @Post('mfa/backup-codes/consume')
  async consumeBackupCode(
    @Body() mfaBackupCodeConsumeDto: MfaBackupCodeConsumeDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.consumeBackupCode(mfaBackupCodeConsumeDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Disable MFA for user (requires current TOTP or backup code).
   * @param request - API request (user context)
   * @param mfaDisableDto - TOTP code or backup code for verification
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('mfa/disable')
  async disableMfa(@Req() request: ApiRequest, @Body() mfaDisableDto: MfaDisableDto, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.disableMfa(request.user!.id, mfaDisableDto, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Generate new backup codes (invalidates previous ones); returns codes (shown once).
   * @param request - API request (user context)
   * @param mfaRegenerateBackupCodesDto - TOTP code for verification
   * @param response - Express response for status and body
   * @returns Response sent via response (backup codes)
   */
  @Post('mfa/backup-codes/regenerate')
  async regenerateBackupCodes(
    @Req() request: ApiRequest,
    @Body() mfaRegenerateBackupCodesDto: MfaRegenerateBackupCodesDto,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.regenerateBackupCodes(
      request.user!.id,
      mfaRegenerateBackupCodesDto,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}

