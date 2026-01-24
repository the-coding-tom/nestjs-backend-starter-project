# NestJS Backend Template

A production-ready NestJS backend template with authentication, queues, cron jobs, and best practices.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Set up database:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Start the development server:
   ```bash
   npm run start:dev
   ```

5. The API will be available at `http://localhost:3000`

## Architecture Overview

This template follows a clean architecture pattern:

```
Controller → Service → Validator → Repository → Database
```

### Key Components

- **APIs**: Feature modules (auth, users, etc.)
- **Repositories**: Data access layer using Prisma
- **Services**: Business logic
- **Validators**: Input validation using Joi
- **Queues**: Background job processing with Bull/Redis
- **Crons**: Scheduled tasks
- **Common**: Shared code (constants, enums, middlewares, interceptors)

## Coding Conventions & Rules

### Repository Layer Rules

**Repositories must be pure data access layers with no business logic:**

1. **No Default Values**: Repositories should never apply default values. All data must be provided explicitly by the calling service layer.
   ```typescript
   // ❌ BAD - Default values in repository
   async createUser(data: CreateUserData) {
     return prisma.user.create({
       data: {
         email: data.email,
         status: data.status || UserStatus.ACTIVE, // NO DEFAULTS
       }
     });
   }

   // ✅ GOOD - Service provides all values
   async createUser(data: CreateUserData) {
     return prisma.user.create({ data });
   }
   ```

2. **No Conditional Values**: No ternary operators or conditional logic. Data should be in the exact format needed.
   ```typescript
   // ❌ BAD - Conditionals in repository
   emailVerifiedAt: data.isEmailVerified ? new Date() : null

   // ✅ GOOD - Service handles transformation
   emailVerifiedAt: data.emailVerifiedAt // Already Date | null
   ```

3. **No Type Casting**: Repositories should not cast types. The calling code must provide data in the correct format.
   ```typescript
   // ❌ BAD - Type casting in repository
   status: data.status as UserStatus

   // ✅ GOOD - UpdateUserData.status is already UserStatus
   status: data.status
   ```

4. **Direct Pass-through**: Repository methods should pass data directly to Prisma without transformation.
   ```typescript
   // ✅ GOOD - Simple pass-through
   async update(id: number, data: UpdateUserData) {
     return prisma.user.update({ where: { id }, data });
   }
   ```

5. **No Data Mapping/Transformation**: Repositories must return data as-is from queries. Never use `.map()`, `.filter()`, or other transformations in repositories. If formatting is needed, use SQL aliases in raw queries or handle it in the service layer.
   ```typescript
   // ❌ BAD - Mapping in repository
   async findAllByUserId(userId: number): Promise<any[]> {
     const result = await prisma.$queryRaw`SELECT ...`;
     return result.map((row) => ({
       id: row.id,
       ownerId: row.owner_id, // Transforming snake_case to camelCase
     }));
   }

   // ✅ GOOD - Use SQL aliases for formatting
   async findAllByUserId(userId: number): Promise<any[]> {
     return prisma.$queryRaw`
       SELECT 
         w.id,
         w.owner_id as "ownerId",
         w.created_at as "createdAt"
       FROM workspaces w
       WHERE ...
     `;
   }

   // ✅ GOOD - Return as-is, service handles transformation if needed
   async findAllByUserId(userId: number): Promise<any[]> {
     return prisma.$queryRaw`SELECT ...`;
   }
   ```

6. **Use Entities for Many Parameters**: When a repository method has many parameters (typically 4+), use an entity class instead of individual parameters.
   ```typescript
   // ❌ BAD - Too many parameters
   async create(
     userId: number,
     provider: OAuthProvider,
     providerUserId: string,
     accessToken?: string,
     refreshToken?: string,
     expiresAt?: number,
     metadata?: any,
   ): Promise<any> {
     return prisma.oAuthAccount.create({
       data: { userId, provider, providerUserId, accessToken, refreshToken, expiresAt, metadata },
     });
   }

   // ✅ GOOD - Use entity for many parameters
   async create(data: CreateOAuthAccountData): Promise<any> {
     return prisma.oAuthAccount.create({ data });
   }
   ```

7. **Wrap Multiple Calls in Transactions**: If a repository method makes multiple database calls, they must be wrapped in a transaction to ensure atomicity.
   ```typescript
   // ❌ BAD - Two separate calls without transaction
   async create(data: CreateWorkspaceMemberData): Promise<WorkspaceMemberResponseEntity> {
     await prisma.workspaceMember.create({ data });
     
     const [member] = await prisma.$queryRaw<WorkspaceMemberResponseEntity[]>`
       SELECT ... FROM workspace_members ...
     `;
     return member;
   }

   // ✅ GOOD - Multiple calls wrapped in transaction
   async create(data: CreateWorkspaceMemberData): Promise<WorkspaceMemberResponseEntity> {
     return prisma.$transaction(async (tx) => {
       await tx.workspaceMember.create({ data });
       
       const [member] = await tx.$queryRaw<WorkspaceMemberResponseEntity[]>`
         SELECT ... FROM workspace_members ...
       `;
       return member!;
     });
   }
   ```

### Service Layer Responsibilities

**Services handle all business logic, defaults, and data transformations:**

1. **Provide Defaults**: Services must set all default values before calling repositories.
   ```typescript
   // ✅ GOOD - Service provides defaults
   const user = await this.userRepository.createLocalAuthUser({
     email: validatedData.email,
     status: UserStatus.INACTIVE,
     timezone: config.defaultTimezone,
     language: config.defaultLanguage,
     type: UserType.CUSTOMER,
   });
   ```

2. **Data Transformation**: Services transform data from DTOs/request format to repository format.
   ```typescript
   // ✅ GOOD - Service transforms isEmailVerified → emailVerifiedAt
   emailVerifiedAt: isEmailVerified ? new Date() : null,
   localAuthAccount: password ? { create: { passwordHash } } : undefined,
   ```

3. **Data Generation**: Services generate derived data (like slugs, tokens, etc.), not validators.
   ```typescript
   // ✅ GOOD - Service generates slug from name
   async createWorkspace(dto: CreateWorkspaceDto, ...) {
     const { validatedData } = await this.validator.validateCreateWorkspace(...);
     const baseSlug = generateSlug(validatedData.name);
     const maxNumber = await this.repository.getMaxSlugNumber(userId, baseSlug);
     const slug = generateUniqueSlugFromMax(baseSlug, maxNumber);
     // ... create workspace with slug
   }
   ```

4. **No Direct Prisma**: Services must use repositories, never direct Prisma calls or transactions.
   ```typescript
   // ❌ BAD - Direct Prisma in service
   async createUser(data: CreateUserData) {
     return prisma.user.create({ data });
   }

   // ❌ BAD - Transaction in service
   async createUser(data: CreateUserData) {
     return prisma.$transaction(async (tx) => {
       // ...
     });
   }

   // ✅ GOOD - Use repository
   async createUser(data: CreateUserData) {
     return this.userRepository.create(data);
   }

   // ✅ GOOD - Transaction in repository
   async createUserWithWorkspace(data: CreateUserWithWorkspaceData) {
     return prisma.$transaction(async (tx) => {
       // Transaction logic in repository
     });
   }
   ```

### Configuration Management

**All constants and defaults must be centralized in the config:**

1. **Use Config File**: Never hardcode values like `'en'`, `'UTC'`, etc. Use `config.defaultLanguage`, `config.defaultTimezone`.
   ```typescript
   // ❌ BAD - Hardcoded values
   fallbackLanguage: 'en'
   timezone: 'UTC'

   // ✅ GOOD - From config
   fallbackLanguage: config.defaultLanguage
   timezone: config.defaultTimezone
   ```

2. **Use Enums**: Always use enums instead of string literals for type-safe values.
   ```typescript
   // ❌ BAD - String literals
   language: 'en'
   authType: 'jwt'
   status: 'ACTIVE'

   // ✅ GOOD - Enum
   language: Language.EN
   authType: AuthType.JWT
   status: UserStatus.ACTIVE
   ```

3. **Entity Types**: Entity classes (like `CreateUserData`, `UpdateUserData`) should use proper enum types, not strings.
   ```typescript
   // ❌ BAD - String type
   export class UpdateUserData {
     status?: string;
   }

   // ✅ GOOD - Enum type
   export class UpdateUserData {
     status?: UserStatus;
   }
   ```

4. **Centralize All Config**: All configuration should be in `src/config/config.ts`. No separate config files or duplicate constants.
   ```typescript
   // ❌ BAD - Separate config file or duplicate constants
   // src/config/i18n.config.ts
   export const i18nConfig = { fallbackLanguage: 'en' };

   // ✅ GOOD - Single config file
   // src/config/config.ts
   export const config = {
     defaultLanguage: Language.EN,
     i18n: { /* ... */ },
   };
   ```

5. **No Duplicate Constants**: Don't define constants in utility files. Use config values directly.
   ```typescript
   // ❌ BAD - Duplicate constants
   const DEFAULT_LANGUAGE = Language.EN;
   const SUPPORTED_LANGUAGES = [Language.EN, Language.FR];

   // ✅ GOOD - Use config
   config.defaultLanguage
   config.i18n.supportedLanguages
   ```

6. **Environment Variables**: Config values can be overridden via environment variables (e.g., `DEFAULT_LANGUAGE`, `DEFAULT_TIMEZONE`).

### Error Handling

1. **Single Response Path**: Services must have a single response path. Use `throwError` for error cases instead of multiple returns.
2. **Validation in Validators**: All validation checks (including email verification, account status) should be in validator methods, not service methods.
3. **Error Message Translation**: Error messages must be translated when thrown (in validators), not in error handlers. See [Internationalization Pattern](#internationalization-i18n-pattern) for details.
4. **Error Codes as Enums**: Use `ErrorCode` enum instead of hardcoded string literals for all error codes.
   ```typescript
   // ❌ BAD - Hardcoded error code
   throwError(message, HttpStatus.BAD_REQUEST, 'validationError');
   
   // ✅ GOOD - Enum error code
   throwError(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
   ```

### Validator Layer Pattern

**Validators must be decoupled from request objects and only receive needed values:**

1. **Pass Combined DTO + Values**: Instead of passing the entire request object, pass only the specific values needed using TypeScript intersection types (`DTO & { key: value }`).
   ```typescript
   // ❌ BAD - Passing entire request object
   async validateLogin(data: LoginDto, request: ApiRequest) {
     const lang = request.language;
     // ...
   }

   // ✅ GOOD - Pass combined object with needed values
   async validateLogin(data: LoginDto & { language: string }) {
     const lang = data.language;
     // ...
   }
   ```

2. **Validate All Input in Schema**: Include request-derived values (like `language`) in the Joi schema for validation.
   ```typescript
   // ✅ GOOD - Language validated in schema
   const schema = Joi.object({
     email: Joi.string().email().required(),
     password: Joi.string().required(),
     language: Joi.string()
       .valid(...config.i18n.supportedLanguages)
       .default(config.defaultLanguage)
       .messages({
         'any.only': translate(this.i18n, 'validation.language.invalid', lang),
       }),
   });
   ```

3. **Extract and Clean Validated Data**: Remove non-DTO fields (like `language`) from validated data before returning.
   ```typescript
   // ✅ GOOD - Extract language for translations, remove from returned data
   const validatedLang = (data as any).language || config.defaultLanguage;
   const { language: _, ...validatedData } = data as any;
   
   // Use validatedLang for translations
   const message = translate(this.i18n, 'validation.error', validatedLang);
   
   // Return clean DTO
   return { validatedData: validatedData as LoginDto, user };
   ```

4. **Service Layer Calls**: Services combine DTOs with needed request values when calling validators.
   ```typescript
   // ✅ GOOD - Service combines DTO + language from request
   const { user } = await this.authValidator.validateLogin({
     ...loginDto,
     language: request.language,
   });
   ```

5. **Validators Only Validate, Never Generate**: Validators should only validate input and check business rules. Data generation/transformation belongs in services.
   ```typescript
   // ❌ BAD - Generating slug in validator
   async validateCreateWorkspace(dto: CreateWorkspaceDto, ...) {
     const slug = generateSlug(dto.name); // NO - This is business logic
     return { validatedData: { ...dto, slug } };
   }

   // ✅ GOOD - Validator only validates
   async validateCreateWorkspace(dto: CreateWorkspaceDto, ...) {
     // Validate schema only
     const schema = Joi.object({ name: Joi.string().required() });
     // ... validation logic
     return { validatedData: dto }; // No slug generation
   }

   // ✅ GOOD - Service generates slug
   async createWorkspace(dto: CreateWorkspaceDto, ...) {
     const { validatedData } = await this.validator.validateCreateWorkspace(...);
     const slug = generateSlug(validatedData.name); // Business logic in service
     // ...
   }
   ```

6. **Benefits**:
   - Validators are decoupled from request objects
   - All inputs are validated in the schema
   - Type-safe with TypeScript intersection types
   - Clear contract: validator receives exactly what it needs
   - Clear separation: validators validate, services transform

### Internationalization (i18n) Pattern

**Error messages must be translated before throwing, not in error handlers:**

1. **Translate in Validators/Throwers**: Error messages should be translated when `throwError` is called, not in catch blocks.
   ```typescript
   // ❌ BAD - Translation in error handler
   catch (error) {
     const message = translate(this.i18n, 'error.key', lang);
     return generateErrorResponse({ ...error, message });
   }

   // ✅ GOOD - Already translated when thrown
   const message = translate(this.i18n, 'validation.email.exists', lang);
   throwError(message, HttpStatus.CONFLICT, ErrorCode.EMAIL_EXISTS);
   ```

2. **Simple Error Handlers**: Error handlers (`generateErrorResponse`, `handleServiceError`) use messages as-is since they're already translated.
   ```typescript
   // ✅ GOOD - Error handler uses message directly
   export function generateErrorResponse(error: CaughtError | any) {
     return {
       status: error.code,
       errorCode: error.errorCode,
       message: error.message || 'An error occurred', // Already translated
     };
   }
   ```

3. **Language Resolution**: Language is resolved once per request by `LanguageMiddleware` and injected into `request.language`. Services use `request.language` directly when translating messages.
   ```typescript
   // ✅ GOOD - Use request.language directly for translations
   message: translate(this.i18n, 'auth.login.success', request.language)
   ```

4. **No Wrapper Functions**: Since `request.language` is always set by middleware, use it directly instead of wrapper functions.
   ```typescript
   // ❌ BAD - Unnecessary wrapper
   const lang = getLanguageFromRequest(request);
   
   // ✅ GOOD - Direct access
   const lang = request.language;
   ```

### Input Validation Rules

**ALL frontend inputs must be validated with Joi schemas, including path and query parameters:**

1. **Path Parameters**: Even after `ParseIntPipe`, path parameters must be validated with Joi to ensure they meet business rules (e.g., positive integers).
   ```typescript
   // Controller: ParseIntPipe converts string → number
   @Get(':id')
   async getWorkspace(@Param('id', ParseIntPipe) id: number, ...) {
     // ...
   }

   // Validator: Joi validates the number meets business rules
   async validateGetWorkspace(workspaceId: number, userId: number, language: string) {
     const schema = Joi.object({
       workspaceId: Joi.number().integer().positive().required().messages({
         'number.positive': 'Workspace ID must be positive',
       }),
       userId: Joi.number().integer().positive().required(),
       language: Joi.string().required(),
     });
     const error = validateJoiSchema(schema, { workspaceId, userId, language });
     if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
     // ... rest of validation
   }
   ```

2. **Query Parameters**: All query parameters must be validated with Joi schemas in validators.
   ```typescript
   // Controller
   @Get()
   async getAllPlans(@Query() query: GetPlansQueryDto, ...) {
     // ...
   }

   // Validator
   async validateGetPlansQuery(data: GetPlansQueryDto & { language: string }) {
     const schema = Joi.object({
       planType: Joi.string().valid('FREE', 'PAID').optional(),
       isActive: Joi.boolean().optional(),
       language: Joi.string().required(),
     });
     // ... validation
   }
   ```

3. **Body Parameters**: All DTOs must be validated with Joi schemas in validators (already standard).

4. **String Path Parameters**: String path parameters (like slugs) must also be validated with Joi.
   ```typescript
   // Controller
   @Get(':slug')
   async getPlanBySlug(@Param('slug') slug: string, ...) {
     // ...
   }

   // Validator
   async validateGetPlanBySlug(slug: string, language: string) {
     const schema = Joi.object({
       slug: Joi.string()
         .pattern(/^[a-z0-9-]+$/)
         .min(1)
         .max(100)
         .required()
         .messages({
           'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
         }),
     });
     const error = validateJoiSchema(schema, { slug });
     if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
     // ... rest of validation
   }
   ```

5. **Why Both ParseIntPipe and Joi?**: `ParseIntPipe` only ensures the value can be parsed as an integer. Joi validation ensures:
   - The number is positive (not 0 or negative)
   - The number meets business rules
   - Consistent error messages via i18n
   - Alignment with project's validation pattern

### Code Organization

1. **Helpers vs Services**: Use `/helpers` folder for utility functions. Service functionality should be helper functions, not service classes.
2. **Validators**: Joi schemas should be defined in the respective validator methods that need them.
3. **Constructors**: Prefer constructing objects directly rather than using mapping helper functions.
4. **Type Definitions**: Use enum types in interfaces and entity classes. Avoid string literal unions (`'jwt' | 'api_key'`) - use enums instead (`AuthType`).

### Entity & Type Definitions

**Entity classes must use proper enum types:**

1. **Use Enum Types**: Entity classes should import and use enum types from `@prisma/client` or `common/enums`.
   ```typescript
   // ❌ BAD - String types
   export class CreateUserData {
     status?: string;
     type?: string;
   }

   // ✅ GOOD - Enum types
   import { UserStatus, UserType } from '@prisma/client';
   export class CreateUserData {
     status?: UserStatus;
     type?: UserType;
   }
   ```

2. **Request Types**: Use enums in request interfaces.
   ```typescript
   // ❌ BAD - String literal union
   authType?: 'jwt' | 'api_key';

   // ✅ GOOD - Enum
   import { AuthType } from '../enums/generic.enum';
   authType?: AuthType;
   ```

### Slug Generation Rules

**Slugs should be auto-generated, never user-provided:**

1. **No Slugs in DTOs**: Slugs should not be in create or update DTOs. They are always auto-generated from names.
   ```typescript
   // ❌ BAD - Slug in DTO
   export class CreateWorkspaceDto {
     name: string;
     slug?: string; // NO - Users shouldn't provide slugs
   }

   // ✅ GOOD - Only name in DTO
   export class CreateWorkspaceDto {
     name: string;
   }
   ```

2. **Auto-Generate in Service**: Slug generation happens in services, not validators.
   ```typescript
   // ✅ GOOD - Service generates slug
   async createWorkspace(dto: CreateWorkspaceDto, ...) {
     const { validatedData } = await this.validator.validateCreateWorkspace(...);
     const baseSlug = generateSlug(validatedData.name);
     const maxNumber = await this.repository.getMaxSlugNumber(userId, baseSlug);
     const slug = generateUniqueSlugFromMax(baseSlug, maxNumber);
     // ... create with generated slug
   }
   ```

3. **Auto-Regenerate on Name Change**: When updating a name, the slug should be auto-regenerated.
   ```typescript
   // ✅ GOOD - Regenerate slug if name changed
   async updateWorkspace(workspaceId: number, dto: UpdateWorkspaceDto, ...) {
     const { validatedData, workspace } = await this.validator.validateUpdateWorkspace(...);
     const updateData = { ...validatedData };
     if (validatedData.name && validatedData.name !== workspace.name) {
       const baseSlug = generateSlug(validatedData.name);
       const maxNumber = await this.repository.getMaxSlugNumber(userId, baseSlug);
       updateData.slug = generateUniqueSlugFromMax(baseSlug, maxNumber);
     }
     // ... update with new slug
   }
   ```

### Database Access Rules

**Never use Prisma directly outside repositories:**

1. **No Direct Prisma in Services**: Services must use repositories for all database operations.
   ```typescript
   // ❌ BAD - Direct Prisma in service
   async getUser(id: number) {
     return prisma.user.findUnique({ where: { id } });
   }

   // ✅ GOOD - Use repository
   async getUser(id: number) {
     return this.userRepository.findById(id);
   }
   ```

2. **No Direct Prisma in Middleware**: Middleware must use repositories, not direct Prisma calls.
   ```typescript
   // ❌ BAD - Direct Prisma in middleware
   async use(req: ApiRequest, res: Response, next: NextFunction) {
     const workspace = await prisma.workspace.findUnique({ where: { id } });
   }

   // ✅ GOOD - Use repository
   async use(req: ApiRequest, res: Response, next: NextFunction) {
     const workspace = await this.workspaceRepository.findById(id);
   }
   ```

3. **Transactions in Repositories**: Complex transactions should be encapsulated in repository methods, not in services.
   ```typescript
   // ❌ BAD - Transaction in service
   async createUserWithWorkspace(data: CreateUserData) {
     return prisma.$transaction(async (tx) => {
       // Transaction logic
     });
   }

   // ✅ GOOD - Transaction in repository
   async createUserWithWorkspaceAndSubscription(data: CreateUserWithWorkspaceAndSubscriptionData) {
     return prisma.$transaction(async (tx) => {
       // Transaction logic in repository
     });
   }
   ```

### Seeding Pattern

**Seeds should be auto-run on application startup using NestJS lifecycle hooks:**

1. **Auto-Run Seeds**: Seeds run automatically when the application starts, not via npm scripts.
   ```typescript
   // ✅ GOOD - Auto-run via lifecycle hook
   @Module({
     imports: [RepositoriesModule],
     providers: [PlansSeederService],
   })
   export class SeedsModule implements OnApplicationBootstrap {
     constructor(private readonly plansSeederService: PlansSeederService) {}

     onApplicationBootstrap() {
       this.plansSeederService.seedPlans();
     }
   }
   ```

2. **Use Repositories**: Seeders must use repositories, not direct Prisma calls.
   ```typescript
   // ❌ BAD - Direct Prisma in seeder
   async seedPlans() {
     await prisma.plan.create({ data: planData });
   }

   // ✅ GOOD - Use repository
   async seedPlans() {
     await this.planRepository.create(planData);
   }
   ```

3. **Separate Data from Logic**: Seed data should be in separate files from seeding logic.
   ```typescript
   // ✅ GOOD - Data in separate file
   // src/seeds/plans/data/plans.data.ts
   export const plansData = [/* ... */];

   // src/seeds/plans/plans-seeder.service.ts
   import { plansData } from './data/plans.data';
   async seedPlans() {
     for (const planData of plansData) {
       // ... seeding logic
     }
   }
   ```

### Security Best Practices

1. **MFA Backup Codes**: Store only cryptographic hashes on the server. Show plain text codes only once when generated.
   ```typescript
   // ✅ GOOD - Store hashes, show plain text once
   async generateBackupCodes(userId: number) {
     const codes = generateBackupCodes(); // Generate plain text
     const hashes = codes.map(code => hashBackupCode(code)); // Hash them
     await this.backupCodeRepository.createMany(hashes); // Store hashes
     return { codes }; // Return plain text once for user to save
   }

   async getBackupCodes(userId: number) {
     const hashes = await this.backupCodeRepository.findByUserId(userId);
     return { codes: [] }; // Return empty - can't retrieve original codes
   }
   ```

### Email Deliverability Rules

**Following these rules ensures emails avoid spam filters and achieve maximum deliverability:**

1. **Subject Line Best Practices**: Use formal, transactional subject lines. Avoid casual language that triggers spam filters.
   ```typescript
   // ❌ BAD - Casual subject that goes to spam
   subject: "You've been invited to join {workspaceName}"
   
   // ✅ GOOD - Formal, transactional subject
   subject: "Workspace invitation: {workspaceName}"
   ```

2. **i18n Interpolation Syntax**: Use `{variable}` syntax, not `{{variable}}` for i18n interpolation.
   ```json
   // ❌ BAD - Double braces won't be parsed correctly
   {
     "subject": "You've been invited to join {{workspaceName}}"
   }
   
   // ✅ GOOD - Single braces for nestjs-i18n
   {
     "subject": "Workspace invitation: {workspaceName}"
   }
   ```

3. **Required Email Headers**: Always include these headers to improve deliverability and reduce spam flagging:
   - `Reply-To`: Set to your sender email
   - `X-Mailer`: Identify your application (e.g., "NestJS Backend Template")
   - `X-Priority`: Set to "1" for normal priority
   - `List-Unsubscribe`: Provide unsubscribe link for compliance
   ```typescript
   // ✅ GOOD - Include all required headers
   headers: {
     'X-Mailer': 'NestJS Backend Template',
     'X-Priority': '1',
     'List-Unsubscribe': `<mailto:${config.brevo.fromEmail}?subject=Unsubscribe>`,
     'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
   }
   ```

4. **Email Tags**: Mark transactional emails with appropriate tags (e.g., 'transactional') for email providers to properly categorize them.
   ```typescript
   // ✅ GOOD - Tag transactional emails
   tags: ['transactional']
   ```

5. **Plain Text Content**: Always generate plain text version from HTML using `html-to-text` library for email clients that don't support HTML.
   ```typescript
   // ✅ GOOD - Generate plain text from HTML
   import { convert } from 'html-to-text';
   
   const html = renderEmailTemplate('verification', language, { ... });
   
   // Convert HTML to plain text for email clients that don't support HTML
   const text = convert(html, {
     wordwrap: 130,
     selectors: [
       { selector: 'a', format: 'anchor' },
       { selector: 'img', format: 'skip' },
     ],
   });
   
   await this.queueEmail({
     to: email,
     subject,
     html,
     text, // Plain text version required
   });
   ```

6. **Sender Information**: Always use consistent sender name and email from config, never hardcode.
   ```typescript
   // ❌ BAD - Hardcoded sender
   sender: {
     name: 'My App',
     email: 'noreply@example.com',
   }
   
   // ✅ GOOD - From config
   sender: {
     name: config.brevo.fromName,
     email: config.brevo.fromEmail,
   }
   ```

7. **Reply-To Header**: Always set `Reply-To` to match your sender email for proper email threading.
   ```typescript
   // ✅ GOOD - Set Reply-To header
   replyTo: {
     email: config.brevo.fromEmail,
     name: config.brevo.fromName,
   }
   ```

8. **Language-Specific Templates**: Store email templates in language-specific folders and use the user's language preference.
   ```
   src/shared-services/email-notification/templates/
   ├── en/
   │   ├── verification.html
   │   ├── welcome.html
   │   └── workspace-invitation.html
   └── fr/
       ├── verification.html
       ├── welcome.html
       └── workspace-invitation.html
   ```

9. **Template Rendering**: Use Handlebars for dynamic template rendering with proper escaping and variable substitution.
   ```typescript
   // ✅ GOOD - Use Handlebars for template rendering
   const html = renderEmailTemplate('verification', language, {
     subject,
     title,
     message,
     verificationUrl,
     expiresIn,
   });
   ```

10. **Testing Deliverability**: Test emails with different providers (Gmail, Outlook, etc.) to ensure proper rendering and delivery before production deployment.

## Features

### Authentication

- Email/Password authentication
- OAuth (Google, GitHub)
- JWT tokens (access + refresh)
- Session management
- Email verification
- Password reset
- Account linking

### Infrastructure

- Queue system (Bull/Redis) with template processors
- Cron jobs with template scheduled tasks
- Repository pattern with Prisma
- Request validation with Joi
- Error handling utilities
- Logging interceptor
- Authentication middleware

## Directory Structure

```
src/
├── apis/              # Feature modules
├── repositories/      # Data access layer
├── queues/           # Queue system
├── crons/            # Scheduled tasks
├── common/           # Shared code
├── config/           # Configuration
├── helpers/          # Helper functions
├── utils/            # Utility functions
└── shared-services/  # Shared business services
```

## Documentation

Each directory contains a README.md file explaining:
- Purpose and patterns
- What belongs here
- Naming conventions
- How to extend/add new features
- Code examples

## Environment Variables

See `.env.example` for all required environment variables.

## Database

This template uses Prisma with PostgreSQL. The schema includes:
- User management
- Authentication (local + OAuth)
- Sessions
- Verification requests

## Next Steps

1. Review the directory-specific README files
2. Configure your environment variables
3. Set up your database
4. Customize authentication providers
5. Add your feature modules following the patterns

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma
- **Queue**: Bull with Redis
- **Validation**: Joi
- **Authentication**: JWT
- **OAuth**: Google, GitHub

