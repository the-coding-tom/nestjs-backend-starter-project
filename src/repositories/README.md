# Repositories Directory

This directory contains the data access layer using the Repository pattern with Prisma.

## Purpose

Repositories abstract database operations and provide a clean interface for services to interact with data. All database queries should go through repositories, not directly through Prisma.

## Structure

```
repositories/
├── repositories.module.ts          # Exports all repositories
├── user.repository.ts              # User data operations
├── session.repository.ts           # Session data operations
├── local-auth-account.repository.ts # Password auth operations
├── oauth-account.repository.ts     # OAuth account operations
├── verification-request.repository.ts # Verification token operations
└── entities/
    ├── user.entity.ts             # User entity types
    └── session.entity.ts          # Session entity types
```

## Repository Pattern

### Responsibilities
- Database queries (CRUD operations)
- Transaction management
- Data transformation
- Query optimization

### Rules
- **Never** import Prisma directly in services - use repositories
- **Always** use repositories for database operations
- Keep business logic in services, not repositories
- Use transactions for multi-step operations
- Return typed entities, not raw Prisma results

## Creating a New Repository

1. Create repository file: `your-entity.repository.ts`
2. Inject Prisma: `import prisma from '../common/prisma'`
3. Implement CRUD methods
4. Register in `repositories.module.ts`
5. Export from module

## Example

```typescript
@Injectable()
export class UserRepository {
  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data,
    });
  }
}
```

## Transactions

Use Prisma transactions for multi-step operations:

```typescript
return prisma.$transaction(async (prismaClient) => {
  const user = await prismaClient.user.create({ ... });
  const account = await prismaClient.account.create({ ... });
  return user;
});
```

