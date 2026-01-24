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

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.login(loginDto, request);
    response.status(status).json(restOfResponse);
  }

  @Post('signup')
  async signup(@Body() registerDto: RegisterDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.register(registerDto, request);
    response.status(status).json(restOfResponse);
  }

  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.logout(logoutDto, request);
    response.status(status).json(restOfResponse);
  }

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

  @Get('verify-email')
  async verifyEmail(@Query() verifyEmailDto: VerifyEmailDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.verifyEmail(verifyEmailDto, request);
    response.status(status).json(restOfResponse);
  }

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

  @Get('google')
  async getGoogleOAuthUrl(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.getGoogleOAuthUrl(request);
    response.status(status).json(restOfResponse);
  }

  @Get('google/callback')
  async handleGoogleCallback(
    @Query() query: OAuthCallbackDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.handleGoogleCallback(
      query,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Get('github')
  async getGitHubOAuthUrl(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.getGitHubOAuthUrl(request);
    response.status(status).json(restOfResponse);
  }

  @Get('github/callback')
  async handleGitHubCallback(
    @Query() query: OAuthCallbackDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.handleGitHubCallback(
      query,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  // MFA Endpoints
  @Post('mfa/setup')
  async setupMfa(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.setupMfa(request.user!.id, request);
    response.status(status).json(restOfResponse);
  }

  @Post('mfa/verify')
  async verifyMfa(@Req() request: ApiRequest, @Body() mfaVerifyDto: MfaVerifyDto, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.verifyMfa(request.user!.id, mfaVerifyDto, request);
    response.status(status).json(restOfResponse);
  }

  @Post('mfa/challenge')
  async challengeMfa(@Body() mfaChallengeDto: MfaChallengeDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.challengeMfa(mfaChallengeDto, request);
    response.status(status).json(restOfResponse);
  }

  @Get('mfa/backup-codes')
  async getBackupCodes(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.getBackupCodes(request.user!.id, request);
    response.status(status).json(restOfResponse);
  }

  @Post('mfa/backup-codes/consume')
  async consumeBackupCode(
    @Body() mfaBackupCodeConsumeDto: MfaBackupCodeConsumeDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.authService.consumeBackupCode(mfaBackupCodeConsumeDto, request);
    response.status(status).json(restOfResponse);
  }

  @Post('mfa/disable')
  async disableMfa(@Req() request: ApiRequest, @Body() mfaDisableDto: MfaDisableDto, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.authService.disableMfa(request.user!.id, mfaDisableDto, request);
    response.status(status).json(restOfResponse);
  }

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

