# Config Directory

This directory contains application configuration.

## Structure

```
config/
└── config.ts    # Centralized configuration
```

## Configuration

The `config.ts` file centralizes all environment variables and configuration:
- Database connection
- JWT secrets and expiration
- OAuth client IDs and secrets
- Redis connection
- Email/SMTP settings
- Validation rules
- Application settings

## Usage

```typescript
import { config } from './config/config';

// Access configuration
const dbUrl = config.databaseUrl;
const jwtSecret = config.authJWTSecret;
```

## Environment Variables

All configuration comes from environment variables defined in `.env.example`.

## Best Practices

- **Centralized**: All config in one place
- **Type Safe**: TypeScript types for all config
- **Defaults**: Provide sensible defaults
- **Validation**: Validate required config on startup

