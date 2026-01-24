# Helpers

Domain-aware pure functions that understand business concepts but don't perform I/O.

## What Belongs Here

Functions that:
- Understand domain terminology (workspace, subscription, member roles)
- Are pure (same input → same output)
- Do NOT perform I/O (no API calls, no database queries)
- Use project-specific types and concepts
- May depend on NestJS services passed as parameters

## Structure

```
helpers/
├── i18n.helper.ts               # Translation helper
├── plan-features.helper.ts      # Plan features/limits extraction
├── response.helper.ts           # API response formatting
├── totp.helper.ts               # TOTP verification (pure)
└── workspace-permission.helper.ts # Workspace access checks
```

## Current Helpers

### Response Helpers (`response.helper.ts`)
- `generateSuccessResponse()`: Format success API responses
- `generateErrorResponse()`: Format error API responses
- `throwError()`: Throw standardized errors

### i18n Helper (`i18n.helper.ts`)
- `translate()`: Translate message keys using I18nService

### TOTP Helper (`totp.helper.ts`)
- `verifyTotpCode()`: Verify TOTP codes (pure function)

### Plan Features Helper (`plan-features.helper.ts`)
- `extractPlanFeatures()`: Extract features from plan object
- `extractPlanLimits()`: Extract limits from plan object
- `buildPlanFeaturesAndLimits()`: Build complete features/limits structure
- `hasFeature()`: Check if a feature is enabled

### Workspace Permission Helper (`workspace-permission.helper.ts`)
- `canManageTeam()`: Check if user can manage team members
- `isWorkspaceOwner()`: Check if user is workspace owner

## Usage

```typescript
import { generateSuccessResponse, generateErrorResponse, throwError } from '../helpers/response.helper';
import { translate } from '../helpers/i18n.helper';
import { canManageTeam } from '../helpers/workspace-permission.helper';
import { buildPlanFeaturesAndLimits } from '../helpers/plan-features.helper';
import { verifyTotpCode } from '../helpers/totp.helper';
```

## Helpers vs Utils

| Aspect | Utils | Helpers |
|--------|-------|---------|
| Domain knowledge | None | Yes |
| Pure functions | Yes | Yes |
| Does I/O | No | No |
| Reusable anywhere | Yes (npm-able) | This project only |
| Location | `utils/` | `helpers/` |

## Example

```typescript
// ✅ Good helper - domain-aware, pure function
export function canManageTeam(
  workspace: Workspace,
  userId: number,
  membership: WorkspaceMember | undefined,
): boolean {
  return workspace.ownerId === userId || membership?.role === 'MANAGER';
}

// ❌ NOT a helper - does I/O (database query)
export async function getWorkspacePermissions(workspaceId: number): Promise<Permissions> {
  return prisma.workspace.findUnique({ ... }); // I/O = belongs in repository
}

// ❌ NOT a helper - generic, no domain knowledge
export function slugify(text: string): string {
  return text.toLowerCase(); // Generic = belongs in utils
}
```
