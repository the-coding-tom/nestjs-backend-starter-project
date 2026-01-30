import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Root routes: hello and health check for load balancers and monitoring.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Root hello message. */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Health check for load balancers and monitoring. */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

