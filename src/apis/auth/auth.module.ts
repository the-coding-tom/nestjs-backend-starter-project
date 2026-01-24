import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthValidator } from './auth.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { EmailModule } from '../../common/services/email/email.module';
import { config } from '../../config/config';

@Module({
  imports: [
    RepositoriesModule,
    EmailModule,
    JwtModule.register({
      secret: config.authJWTSecret,
      signOptions: { expiresIn: config.tokenExpirationInSeconds },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthValidator],
  exports: [AuthService],
})
export class AuthModule { }

