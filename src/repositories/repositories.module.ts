import { Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { SessionRepository } from './session.repository';
import { LocalAuthAccountRepository } from './local-auth-account.repository';
import { OAuthAccountRepository } from './oauth-account.repository';
import { VerificationRequestRepository } from './verification-request.repository';
import { BackupCodeRepository } from './backup-code.repository';
import { MfaChallengeSessionRepository } from './mfa-challenge-session.repository';
import { PlanRepository } from './plan.repository';
import { SubscriptionRepository } from './subscription.repository';
import { WorkspaceRepository } from './workspace.repository';
import { WorkspaceMemberRepository } from './workspace-member.repository';
import { WorkspaceInvitationRepository } from './workspace-invitation.repository';
import { DeviceRepository } from './device.repository';
import { NotificationRepository } from './notification.repository';
import { WebhookEventLogRepository } from './webhook-event-log.repository';
import { StripeCheckoutSessionRepository } from './stripe-checkout-session.repository';

@Module({
  providers: [
    UserRepository,
    SessionRepository,
    LocalAuthAccountRepository,
    OAuthAccountRepository,
    VerificationRequestRepository,
    BackupCodeRepository,
    MfaChallengeSessionRepository,
    PlanRepository,
    SubscriptionRepository,
    WorkspaceRepository,
    WorkspaceMemberRepository,
    WorkspaceInvitationRepository,
    DeviceRepository,
    NotificationRepository,
    WebhookEventLogRepository,
    StripeCheckoutSessionRepository,
  ],
  exports: [
    UserRepository,
    SessionRepository,
    LocalAuthAccountRepository,
    OAuthAccountRepository,
    VerificationRequestRepository,
    BackupCodeRepository,
    MfaChallengeSessionRepository,
    PlanRepository,
    SubscriptionRepository,
    WorkspaceRepository,
    WorkspaceMemberRepository,
    WorkspaceInvitationRepository,
    DeviceRepository,
    NotificationRepository,
    WebhookEventLogRepository,
    StripeCheckoutSessionRepository,
  ],
})
export class RepositoriesModule {}

