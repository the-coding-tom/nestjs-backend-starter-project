import { BullModule } from '@nestjs/bull';
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { AuthModule } from './apis/auth/auth.module';
import { PlansModule } from './apis/plans/plans.module';
import { SubscriptionsModule } from './apis/subscriptions/subscriptions.module';
import { StripeWebhookModule } from './apis/webhooks/stripe/stripe-webhook.module';
import { BrevoWebhookModule } from './apis/webhooks/brevo/brevo-webhook.module';
import { WhatsAppWebhookModule } from './apis/webhooks/whatsapp/whatsapp-webhook.module';
import { WorkspacesModule } from './apis/workspaces/workspaces.module';
import { DevicesModule } from './apis/devices/devices.module';
import { NotificationsModule } from './apis/notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LanguageMiddleware } from './common/middlewares/language.middleware';
import { IsAuthenticatedMiddleware } from './common/middlewares/is-authenticated.middleware';
import { IsUserScopeMiddleware } from './common/middlewares/is-user-scope.middleware';
import { WorkspaceContextMiddleware } from './common/middlewares/workspace-context.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { config } from './config/config';
import { CronsModule } from './crons/crons.module';
import { QueueProducersModule } from './queues/queue-producers.module';
import { QueueProcessorsModule } from './queues/queue-processors.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { SeedsModule } from './seeds/seeds.module';

@Module({
  imports: [
    // I18n Module for internationalization
    I18nModule.forRoot({
      fallbackLanguage: config.defaultLanguage,
      loaderOptions: {
        ...config.i18n.loaderOptions,
        watch: !config.isProduction,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    // Global Bull configuration for queues
    BullModule.forRoot({
      redis: {
        host: config.redisClusterEndpoint,
        port: config.redisClusterPort,
      },
      defaultJobOptions: {
        removeOnComplete: {
          age: config.jobOptions.complete.age,
          count: config.jobOptions.complete.count,
        },
        removeOnFail: {
          age: config.jobOptions.fail.age,
          count: config.jobOptions.fail.count,
        },
        attempts: config.queue.jobRetryAttempts,
        backoff: {
          type: config.queue.backoffType,
          delay: config.queue.jobRetryDelayMs,
        },
      },
      settings: config.bullSettings,
    }),
    // JWT Module
    JwtModule.register({
      global: true,
      secret: config.authJWTSecret,
      signOptions: {
        expiresIn: config.tokenExpirationInSeconds,
      },
    }),
    // Schedule Module for cron jobs
    ScheduleModule.forRoot(),
    // Core modules
    RepositoriesModule,
    QueueProducersModule,
    QueueProcessorsModule,
    CronsModule,
    SeedsModule,
    // API modules
    AuthModule,
    PlansModule,
    SubscriptionsModule,
    StripeWebhookModule,
    BrevoWebhookModule,
    WhatsAppWebhookModule,
    WorkspacesModule,
    DevicesModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Language resolution middleware - runs first for all routes
    consumer.apply(LanguageMiddleware).forRoutes('*path');

    // Authentication middleware for all routes except public auth endpoints
    consumer
      .apply(IsAuthenticatedMiddleware)
      .exclude(
        { path: 'auth/signup', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST },
        { path: 'auth/confirm-password-reset', method: RequestMethod.POST },
        { path: 'auth/verify-email', method: RequestMethod.GET },
        { path: 'auth/resend-verification', method: RequestMethod.POST },
        { path: 'auth/google', method: RequestMethod.GET },
        { path: 'auth/google/callback', method: RequestMethod.GET },
        { path: 'auth/github', method: RequestMethod.GET },
        { path: 'auth/github/callback', method: RequestMethod.GET },
        { path: 'auth/mfa/challenge', method: RequestMethod.POST },
        { path: 'auth/mfa/backup-codes/consume', method: RequestMethod.POST },
        { path: 'workspaces/invitations/preview', method: RequestMethod.GET },
        { path: 'webhooks/stripe', method: RequestMethod.POST },
        { path: 'webhooks/brevo', method: RequestMethod.POST },
        { path: 'webhooks/whatsapp', method: RequestMethod.GET },
        { path: 'webhooks/whatsapp', method: RequestMethod.POST },
      )
      .forRoutes('*path');

    // Workspace context middleware (optional - extracts workspace from header/query)
    consumer
      .apply(WorkspaceContextMiddleware)
      .exclude(
        { path: 'auth/*path', method: RequestMethod.ALL },
        { path: 'plans/*path', method: RequestMethod.ALL },
        { path: 'subscriptions/*path', method: RequestMethod.ALL },
        { path: 'webhooks/*path', method: RequestMethod.ALL },
        { path: 'workspaces', method: RequestMethod.GET }, // List workspaces doesn't need context
        { path: 'workspaces', method: RequestMethod.POST }, // Create workspace doesn't need context
      )
      .forRoutes('*path');

    // User Scope middleware (blocks API key access, requires JWT)
    consumer
      .apply(IsUserScopeMiddleware)
      .forRoutes(
        { path: 'auth/logout', method: RequestMethod.POST },
        { path: 'workspaces/*path', method: RequestMethod.ALL },
        // TODO: Add more user-scoped routes here
      );
  }
}

