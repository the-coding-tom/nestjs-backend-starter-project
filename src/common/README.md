# Common Directory

This directory contains shared infrastructure code used across the entire application.

## Structure

```
common/
├── constants/          # Application constants
│   ├── queues.constant.ts
│   └── time.constant.ts
├── enums/              # TypeScript enums
│   └── generic.enum.ts
├── entities/           # Shared type definitions
│   ├── auth.entity.ts
│   ├── mfa.entity.ts
│   └── oauth.entity.ts
├── interceptors/       # HTTP interceptors
│   └── logging.interceptor.ts
├── middlewares/        # Express/NestJS middlewares
│   ├── is-authenticated.middleware.ts
│   ├── is-user-scope.middleware.ts
│   ├── language.middleware.ts
│   └── workspace-context.middleware.ts
├── services/           # Shared services (I/O, integrations)
│   ├── brevo/          # Brevo email API integration
│   ├── email/          # Email notification service
│   ├── inbox/          # Inbox notification service
│   ├── oauth/          # OAuth provider integrations
│   ├── push/           # Push notification service (FCM)
│   └── stripe/         # Stripe API integration
├── types/              # TypeScript type definitions
│   ├── request.types.ts
│   └── response.types.ts
└── prisma.ts           # Prisma client instance
```

## Services

Shared services that perform I/O and are used by multiple modules:

### Email Service
```typescript
import { EmailService } from '../common/services/email/email.service';
import { EmailModule } from '../common/services/email/email.module';
```

### Push Notification Service
```typescript
import { PushService } from '../common/services/push/push.service';
import { PushModule } from '../common/services/push/push.module';
```

### Stripe Service
```typescript
import { createCheckoutSession, cancelSubscription } from '../common/services/stripe/stripe.service';
```

### OAuth Service
```typescript
import { verifyGoogleToken, verifyGitHubToken } from '../common/services/oauth/oauth.service';
```

### Brevo Service
```typescript
import { sendEmail } from '../common/services/brevo/brevo.service';
```

## Service Structure

Each service with supporting files uses feature-based organization:

```
services/email/
├── email.service.ts      # Main service
├── email.module.ts       # NestJS module
├── dto/
│   └── send-email.dto.ts
├── helpers/              # Service-specific pure helpers
│   └── email-template.helper.ts
└── templates/
    ├── en/
    └── fr/
```

## Constants

Application-wide constants:
- Queue names (`PUSH_NOTIFICATION_QUEUE`, etc.)
- Time constants

## Enums

Shared TypeScript enums:
- `UserStatus`, `UserType`
- `OAuthProvider`
- `NotificationType`, `NotificationStatus`
- `ErrorCode`

## Middlewares

Express/NestJS middlewares:
- **IsAuthenticatedMiddleware**: Validates JWT tokens
- **IsUserScopeMiddleware**: Ensures JWT (not API key) auth
- **LanguageMiddleware**: Sets request language
- **WorkspaceContextMiddleware**: Sets workspace context

## Prisma

Single Prisma client instance for the entire application.

```typescript
import prisma from '../common/prisma';
```

## Note on Helpers

Domain-aware pure functions are located in `src/helpers/` at the root level, not in this directory. See the helpers folder for workspace permissions, MFA setup, and other domain-specific pure functions.
