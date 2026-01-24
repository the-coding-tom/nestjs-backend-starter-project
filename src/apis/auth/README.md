# APIs Directory

This directory contains all API feature modules. Each module represents a distinct feature or domain of your application.

## Structure

Each API module follows this structure:

```
apis/
└── auth/
    ├── auth.module.ts      # NestJS module definition
    ├── auth.controller.ts  # HTTP request handlers
    ├── auth.service.ts     # Business logic
    ├── auth.validator.ts   # Input validation (Joi)
    └── dto/
        └── auth.dto.ts    # Data transfer objects
```

## Module Pattern

### Controller
- Handles HTTP requests and responses
- Uses decorators (@Get, @Post, etc.)
- Calls service methods
- Returns standardized responses

### Service
- Contains business logic
- Uses repositories for data access
- Handles errors and returns standardized responses
- Uses validators for input validation

### Validator
- Validates input using Joi schemas
- Checks business rules (user exists, permissions, etc.)
- Throws errors with proper status codes
- Returns validated data

### DTOs
- TypeScript classes/interfaces for request/response data
- Used for type safety
- Documented with JSDoc comments

## Creating a New API Module

1. Create module directory: `apis/your-feature/`
2. Create files:
   - `your-feature.module.ts`
   - `your-feature.controller.ts`
   - `your-feature.service.ts`
   - `your-feature.validator.ts`
   - `dto/your-feature.dto.ts`
3. Register module in `app.module.ts`
4. Add routes to middleware configuration if needed

## Example

See `auth/` module for a complete example with:
- Authentication endpoints
- OAuth integration
- Email verification
- Password reset
- Session management

