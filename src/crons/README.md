# Crons Directory

This directory contains scheduled tasks (cron jobs) that run at specified intervals.

## Purpose

Cron jobs handle periodic tasks:
- Data cleanup
- Report generation
- Cache invalidation
- Scheduled notifications
- System maintenance

## Structure

```
crons/
├── crons.module.ts        # Registers all cron jobs
└── processes/
    └── cleanup-expired-sessions.cron.ts # Session cleanup
```

## Cron Jobs

### Creating a Cron Job

1. **Create cron class** in `processes/your-cron.ts`:
   ```typescript
   @Injectable()
   export class YourCron {
     @Cron(CronExpression.EVERY_HOUR)
     async handleCron() {
       // Your scheduled task
     }
   }
   ```

2. **Register in** `crons.module.ts`:
   ```typescript
   providers: [YourCron]
   ```

### Cron Expressions

Use predefined expressions or custom patterns:

**Predefined:**
- `CronExpression.EVERY_SECOND`
- `CronExpression.EVERY_MINUTE`
- `CronExpression.EVERY_HOUR`
- `CronExpression.EVERY_DAY_AT_MIDNIGHT`

**Custom:**
- `'0 0 * * * *'` - Every hour
- `'0 0 0 * * *'` - Every day at midnight
- `'0 0 0 * * 0'` - Every Sunday at midnight

**Format:** `second minute hour day month dayOfWeek`

### Best Practices

- **Log execution**: Always log when cron runs
- **Handle errors**: Wrap logic in try-catch
- **Idempotent**: Jobs should be safe to run multiple times
- **Efficient**: Don't block for too long
- **Monitor**: Track execution time and failures

## Example

See `processes/cleanup-expired-sessions.cron.ts` for a complete example.

## Common Use Cases

- **Cleanup**: Delete expired data, old sessions
- **Reports**: Generate daily/weekly reports
- **Sync**: Sync data with external services
- **Notifications**: Send scheduled notifications
- **Maintenance**: Database optimization, cache warming

