# Queues Directory

This directory contains the queue system for background job processing using Bull (Redis).

## Purpose

Queues handle asynchronous tasks that don't need to block the main request/response cycle:
- Email sending
- File processing
- Data synchronization
- Scheduled tasks
- Heavy computations

## Structure

```
queues/
├── queue-producers.module.ts    # Registers all queues
├── queue-processors.module.ts   # Registers all processors
└── processors/
    └── email-notification.processor.ts # Email notification processor
```

## Queue System

### Queue Producers Module
- Registers all queues that can receive jobs
- Exports queues for injection in services
- Configured in `queue-producers.module.ts`

### Queue Processors Module
- Registers all processors that handle jobs
- Imports required modules (repositories, services)
- Configured in `queue-processors.module.ts`

### Processors
- Handle job processing for a queue
- Use `@Processor('queue-name')` decorator
- Use `@Process()` without arguments to handle all jobs in the queue (recommended for single-purpose queues)
- Use `@Process('job-name')` to handle specific named jobs (for queues with multiple job types)
- Handle errors and retries

## Creating a New Queue

1. **Add queue name** to `common/constants/queues.constant.ts`:
   ```typescript
   export const YOUR_QUEUE = 'your-queue';
   ```

2. **Register queue** in `queue-producers.module.ts`:
   ```typescript
   BullModule.registerQueue({ name: YOUR_QUEUE })
   ```

3. **Create processor** in `processors/your-queue.processor.ts`:
   ```typescript
   @Processor(YOUR_QUEUE)
   export class YourQueueProcessor {
     // For single-purpose queues, use @Process() without arguments
     @Process()
     async handleJob(job: Job<YourJobPayload>) {
       // Process job
     }
     
     // For queues with multiple job types, use named handlers
     // @Process('job-type-1')
     // async handleJobType1(job: Job<YourJobPayload>) { ... }
   }
   ```

4. **Register processor** in `queue-processors.module.ts`

5. **Use queue** in services:
   ```typescript
   @InjectQueue(YOUR_QUEUE)
   private readonly yourQueue: Queue;
   
   // For @Process() without arguments, add jobs without a name
   await this.yourQueue.add(payload, { attempts: 3 });
   
   // For named processors, specify the job name
   // await this.yourQueue.add('job-type-1', payload, { attempts: 3 });
   ```

## Job Configuration

Jobs can be configured with:
- `attempts`: Number of retries
- `backoff`: Retry delay strategy
- `delay`: Initial delay before processing
- `timeout`: Job timeout

## Error Handling

- Errors thrown in processors trigger retries
- Configure retry attempts in queue config
- Log errors for debugging
- Use exponential backoff for retries

## Example

See `processors/email-notification.processor.ts` for a complete example.

