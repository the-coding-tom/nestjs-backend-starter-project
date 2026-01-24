# Utils Directory

This directory contains **pure, generic utility functions** that could work in ANY codebase.

## Characteristics

- **Pure**: Same input always produces same output
- **Stateless**: No side effects, no external state
- **Generic**: No business/domain knowledge
- **Framework-agnostic**: Could be published as npm package
- **No I/O**: No API calls, database, file system, or network

## Structure

```
utils/
├── backup-code.util.ts   # Backup code generation and verification
├── html-to-text.util.ts  # HTML to plain text conversion
├── joi.util.ts           # Joi schema validation helper
├── logger.util.ts        # Winston logger setup
├── password.util.ts      # Password hashing (bcrypt)
├── slug.util.ts          # URL slug generation
└── token.util.ts         # Session token generation
```

## Utilities

### Password Utils (`password.util.ts`)
- `hashPassword()`: Hash passwords with bcrypt
- `validatePassword()`: Verify password against hash

### Backup Code Utils (`backup-code.util.ts`)
- `generateBackupCodes()`: Generate MFA backup codes
- `hashBackupCode()`: Hash a backup code
- `verifyBackupCode()`: Verify a backup code

### Slug Utils (`slug.util.ts`)
- `generateSlug()`: Generate URL-friendly slug from text
- `generateUniqueSlugFromMax()`: Generate unique slug with number suffix

### Token Utils (`token.util.ts`)
- `generateSessionToken()`: Generate secure session tokens

### HTML Utils (`html-to-text.util.ts`)
- `convertHtmlToText()`: Convert HTML to plain text

### Validation Utils (`joi.util.ts`)
- `validateJoiSchema()`: Validate data against Joi schema

### Logger (`logger.util.ts`)
- Winston logger configuration
- `logError()`: Log errors
- `logInfoMessage()`: Log info messages
- `logWarningMessage()`: Log warnings

## Usage

```typescript
import { hashPassword, validatePassword } from '../utils/password.util';
import { generateSlug } from '../utils/slug.util';
import { logError } from '../utils/logger.util';
import { validateJoiSchema } from '../utils/joi.util';
```

## What Does NOT Belong Here

Code with these characteristics should go elsewhere:

| Characteristic | Where It Goes |
|---------------|---------------|
| Has domain knowledge (workspace, subscription, etc.) | `helpers/` |
| Does I/O (database, API, file system) | `common/services/` or repositories |
| NestJS/framework-specific | `helpers/` or services |

See `helpers/README.md` for domain-aware pure functions.
