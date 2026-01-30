import 'dotenv/config';
import { join } from 'path';
import { Language } from '../common/enums/generic.enum';

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT || '3000'),

  // Authentication & Security
  authJWTSecret: process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET!,
  authRefreshJWTSecret: process.env.AUTH_REFRESH_JWT_SECRET || process.env.JWT_SECRET!,
  tokenExpiration: process.env.TOKEN_EXPIRATION || '15m',
  refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  tokenExpirationInSeconds: 15 * 60, // 15 minutes for access tokens
  refreshTokenExpirationInSeconds: 7 * 24 * 60 * 60, // 7 days Reference: 7 * HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE
  bcryptSaltRounds: 10,
  bearerTokenPrefixLength: 7, // "Bearer ".length

  // OAuth Configuration
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authUrl: process.env.GITHUB_AUTH_URL || 'https://github.com/login/oauth/authorize',
      tokenUrl: process.env.GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token',
    },
    // Frontend URL where OAuth providers redirect after authentication
    // Configure this same URL in Google Cloud Console and GitHub OAuth App settings
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  },

  // Email Configuration (SMTP) - Deprecated, use Brevo instead
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM_EMAIL || 'noreply@yourapp.com',
    fromName: process.env.SMTP_FROM_NAME || 'Your App',
  },

  // Brevo Email API Configuration
  brevo: {
    apiKey: process.env.BREVO_API_KEY!,
    fromEmail: process.env.BREVO_FROM_EMAIL || 'noreply@yourapp.com',
    fromName: process.env.BREVO_FROM_NAME || 'Your App',
  },

  // Firebase Cloud Messaging (FCM) Configuration
  fcm: {
    serviceAccountKeyPath: process.env.FCM_SERVICE_ACCOUNT_KEY_PATH,
    serviceAccountKey: process.env.FCM_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FCM_SERVICE_ACCOUNT_KEY)
      : undefined,
  },

  // WhatsApp Cloud API Configuration
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!,
    appSecret: process.env.WHATSAPP_APP_SECRET!,
    apiVersion: 'v24.0',
    baseUrl: 'https://graph.facebook.com',
  },

  // Queue Configuration (Redis)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
  },
  redisClusterEndpoint: process.env.REDIS_HOST || 'localhost',
  redisClusterPort: parseInt(process.env.REDIS_PORT || '6379'),
  queue: {
    jobRetryAttempts: 3,
    jobRetryDelayMs: 5000,
    backoffType: (process.env.QUEUE_BACKOFF_TYPE || 'exponential') as 'fixed' | 'exponential',
  },
  jobOptions: {
    complete: {
      age: 3600, // Remove completed jobs older than 1 hour (seconds)
      count: 1000, // Keep at most 1000 completed jobs
    },
    fail: {
      age: 86400, // Remove failed jobs older than 24 hours (seconds)
      count: 5000, // Keep at most 5000 failed jobs
    },
  },
  // Bull queue advanced settings (stalled job detection, locks)
  bullSettings: {
    stalledInterval: 30000, // Check for stalled jobs every 30s (ms)
    maxStalledCount: 2, // Fail job after 2 stalls
    lockDuration: 30000, // Lock jobs for 30s while processing (ms)
  },

  // Queue cleanup cron thresholds (prevents Redis memory bloat)
  queueCleanup: {
    completedCleanAgeMs: 3600 * 1000, // 1 hour – remove completed jobs older than this
    failedCleanAgeMs: 24 * 3600 * 1000, // 24 hours – remove failed jobs older than this
    stuckActiveAgeMs: 3600 * 1000, // 1 hour – treat active jobs older than this as stuck
    redisMemoryWarnPercent: 70,
    redisMemoryCriticalPercent: 80,
  },

  // Frontend URL (for redirects and email links)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // User defaults
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  defaultLanguage: (process.env.DEFAULT_LANGUAGE as Language) || Language.EN,

  // i18n Configuration
  i18n: {
    supportedLanguages: [Language.EN, Language.FR],
    loaderOptions: {
      path: join(process.cwd(), 'dist/i18n/'),
    },
  },

  // MFA Configuration
  mfa: {
    issuer: process.env.MFA_ISSUER || 'Your App', // TOTP issuer name for authenticator apps
    totpWindow: parseInt(process.env.TOTP_WINDOW || '2'), // Time window for TOTP verification (±2 steps = 60 seconds tolerance)
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    apiVersion: '2025-12-15.clover' as const,
  },

  // Webhook Configuration
  webhooks: {
    brevo: {
      bearerToken: process.env.BREVO_WEBHOOK_TOKEN!,
      allowedIpRanges: ['1.179.112.0/20', '172.246.240.0/20'], // Brevo IP ranges
    },
    whatsapp: {
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!,
      appSecret: process.env.WHATSAPP_APP_SECRET!,
    },
  },

  // Validation Rules
  validation: {
    password: {
      minLength: 6,
      maxLength: 128,
    },
    randomString: {
      defaultLength: 32,
    },
  },
};

