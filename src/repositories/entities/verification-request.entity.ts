import { VerificationRequestType } from '@prisma/client';

export class CreateVerificationRequestData {
  userId: number;
  email: string;
  token: string;
  type: VerificationRequestType;
  expiresAt: Date;
  [key: string]: any;
}

