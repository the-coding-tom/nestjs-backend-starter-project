export class JwtPayload {
  sub: number;
  email: string;
  userType: string;
  status: string;
  isEmailVerified: boolean;
  iat?: number;
  exp?: number;
}

export class AuthTokens {
  accessToken: string;
  refreshToken: string;
}

